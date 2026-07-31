import type { ConversationTurnRecord } from "@/lib/chat-session";

type ResolvableDomain = "medication" | "condition" | "appointment" | "care-plan" | "lifestyle";

const DIRECT_INTENT_PATTERN =
  /\b(medication|medications|medicine|meds|condition|conditions|appointment|appointments|visit|visits|schedule|care plan|care task|diet|eat|exercise|activity|sleep|habit|diagnose|diagnosis)\b/i;

const FOLLOW_UP_PATTERN =
  /^(what about that\??|what about it\??|what about those\??|when is it\??|when is that\??|tell me more\.?|explain that\.?|explain that again\.?|can you explain that\??|and that\??|and it\??|same one\.?|that one\.?|what should i do about that\??)$/i;

export type ReferenceResolutionResult = {
  resolvedMessage: string | null;
  inferredDomain: ResolvableDomain | null;
  confidence: "high" | "low" | "none";
  fallbackMessage: string | null;
  sourceTurnOffset: number | null;
};

function isDirectIntent(message: string): boolean {
  return DIRECT_INTENT_PATTERN.test(message);
}

function isFollowUpShorthand(message: string): boolean {
  return FOLLOW_UP_PATTERN.test(message.trim());
}

function buildResolvedMessage(domain: ConversationTurnRecord["domain"]): string | null {
  switch (domain) {
    case "medication":
      return "What medications am I taking?";
    case "condition":
      return "Can you explain my condition?";
    case "appointment":
      return "When is my next appointment?";
    case "care-plan":
      return "What is in my care plan?";
    case "lifestyle":
      return "What lifestyle guidance fits my profile?";
    default:
      return null;
  }
}

function isResolvableDomain(domain: ConversationTurnRecord["domain"]): domain is ResolvableDomain {
  return (
    domain === "medication" ||
    domain === "condition" ||
    domain === "appointment" ||
    domain === "care-plan" ||
    domain === "lifestyle"
  );
}

export function resolveFollowUpReference(
  message: string,
  recentTurns: ConversationTurnRecord[]
): ReferenceResolutionResult {
  if (isDirectIntent(message) || !isFollowUpShorthand(message)) {
    return {
      resolvedMessage: null,
      inferredDomain: null,
      confidence: "none",
      fallbackMessage: null,
      sourceTurnOffset: null
    };
  }

  const turns = [...recentTurns].reverse();
  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (!isResolvableDomain(turn.domain)) {
      continue;
    }

    const resolvedMessage = buildResolvedMessage(turn.domain);
    if (!resolvedMessage) {
      continue;
    }

    return {
      resolvedMessage,
      inferredDomain: turn.domain,
      confidence: "high",
      fallbackMessage: null,
      sourceTurnOffset: index
    };
  }

  return {
    resolvedMessage: null,
    inferredDomain: null,
    confidence: "low",
    fallbackMessage:
      "I want to make sure I follow you. Are you asking about your medication, condition, appointment, care plan, or lifestyle routine?",
    sourceTurnOffset: null
  };
}
