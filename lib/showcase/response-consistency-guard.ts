import type { ConversationTurnRecord } from "@/lib/chat-session";

type ConsistencyDomain = ConversationTurnRecord["domain"];

export type ConsistencyGuardInput = {
  draftResponse: string;
  domain: ConsistencyDomain;
  entityReferences: string[];
  recentTurns: ConversationTurnRecord[];
};

export type ConsistencyGuardResult = {
  finalResponse: string;
  contradictionDetected: boolean;
  rewriteApplied: boolean;
  fallbackApplied: boolean;
  reason: string | null;
  sourceTurnOffset: number | null;
};

type ContradictionSignals = {
  saysNone: boolean;
  saysHasData: boolean;
};

function signalsForDomain(domain: ConsistencyDomain, text: string): ContradictionSignals {
  const normalized = text.toLowerCase();

  if (domain === "appointment") {
    return {
      saysNone: normalized.includes("no upcoming visits listed"),
      saysHasData:
        normalized.includes("upcoming visit details") ||
        normalized.includes("visit encounter") ||
        /\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}z/i.test(normalized)
    };
  }

  if (domain === "care-plan") {
    return {
      saysNone: normalized.includes("no care plan tasks listed"),
      saysHasData:
        normalized.includes("care plan tasks") || normalized.includes("review blood pressure trend")
    };
  }

  if (domain === "medication") {
    return {
      saysNone: normalized.includes("no active medications listed"),
      saysHasData: normalized.includes("listed medications") || normalized.includes("medication")
    };
  }

  if (domain === "condition") {
    return {
      saysNone: normalized.includes("no active conditions listed"),
      saysHasData: normalized.includes("current conditions") || normalized.includes("ongoing health condition")
    };
  }

  return {
    saysNone: false,
    saysHasData: false
  };
}

function contradictory(current: ContradictionSignals, previous: ContradictionSignals): boolean {
  return (current.saysNone && previous.saysHasData) || (current.saysHasData && previous.saysNone);
}

function consistencyFallbackMessage(): string {
  return "I may be mixing details from earlier messages. To keep this accurate, please tell me whether you want medication, condition, appointment, care plan, or lifestyle guidance, and I will restate it from your active profile.";
}

export function applyResponseConsistencyGuard(input: ConsistencyGuardInput): ConsistencyGuardResult {
  const candidateSignals = signalsForDomain(input.domain, input.draftResponse);
  if (!candidateSignals.saysNone && !candidateSignals.saysHasData) {
    return {
      finalResponse: input.draftResponse,
      contradictionDetected: false,
      rewriteApplied: false,
      fallbackApplied: false,
      reason: null,
      sourceTurnOffset: null
    };
  }

  const recent = [...input.recentTurns].reverse();
  let contradictionSeen = false;

  for (let index = 0; index < recent.length; index += 1) {
    const prior = recent[index];
    if (prior.domain !== input.domain) {
      continue;
    }

    const priorSignals = signalsForDomain(prior.domain, prior.assistantMessage);
    if (!contradictory(candidateSignals, priorSignals)) {
      continue;
    }

    contradictionSeen = true;
    if (prior.confidence !== "high") {
      continue;
    }

    return {
      finalResponse: prior.assistantMessage,
      contradictionDetected: true,
      rewriteApplied: true,
      fallbackApplied: false,
      reason: "conflict_with_recent_turn",
      sourceTurnOffset: index
    };
  }

  if (contradictionSeen) {
    return {
      finalResponse: consistencyFallbackMessage(),
      contradictionDetected: true,
      rewriteApplied: false,
      fallbackApplied: true,
      reason: "consistency_not_guaranteed",
      sourceTurnOffset: null
    };
  }

  return {
    finalResponse: input.draftResponse,
    contradictionDetected: false,
    rewriteApplied: false,
    fallbackApplied: false,
    reason: null,
    sourceTurnOffset: null
  };
}
