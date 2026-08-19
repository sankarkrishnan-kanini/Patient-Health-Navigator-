import type { PatientProfileSummary, ProfileCondition } from "@/lib/showcase/profile-summary";
import { getConditionContext, type ConditionKnowledge } from "@/lib/showcase/medical-knowledge-base";

const CONDITION_INTENT_PATTERN =
  /\b(condition|conditions|diagnosis|diagnosed|disease|illness|symptom|symptoms|fever|cough|pain|headache|nausea|explain|what is)\b/i;

const MEDICATION_SIGNAL_PATTERN =
  /\b(medication|medications|medicine|meds|pill|pills|prescription|prescriptions|dose|dosage|schedule|tablet|capsule)\b/i;

const GENERIC_REQUEST_TERMS = new Set([
  "condition",
  "conditions",
  "diagnosis",
  "diagnoses",
  "disease",
  "illness",
  "my condition",
  "my conditions"
]);

type ConditionContext = {
  label: string;
};

type ProfileMarkers = {
  activeConditionCount: number;
  careTaskCount: number;
  upcomingVisitCount: number;
};

export type ConditionGuidanceResult = {
  isConditionIntent: boolean;
  assistantMessage: string | null;
  conditionsUsed: ConditionContext[];
  unknownRequestedCondition: string | null;
  profileMarkers: ProfileMarkers;
  contextSourceRefs: string[];
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasConditionIntent(message: string): boolean {
  if (!CONDITION_INTENT_PATTERN.test(message)) {
    return false;
  }

  // Guard against overlap like "explain my medications".
  if (MEDICATION_SIGNAL_PATTERN.test(message)) {
    return false;
  }

  return true;
}

function toConditionContext(condition: ProfileCondition): ConditionContext {
  return {
    label: condition.label
  };
}

function extractRequestedCondition(message: string): string | null {
  const normalized = normalizeText(message);
  const matcher = /(?:explain|about|what is|what s|tell me about)\s+([a-z0-9\s-]{3,80})/.exec(normalized);
  if (!matcher?.[1]) {
    return null;
  }

  const candidate = matcher[1]
    .replace(/\b(for me|please|today|right now|in plain language)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || GENERIC_REQUEST_TERMS.has(candidate)) {
    return null;
  }

  return candidate;
}

function isConditionLinkedToProfile(
  requestedCondition: string,
  activeConditions: ProfileCondition[]
): boolean {
  const normalizedRequest = normalizeText(requestedCondition);
  return activeConditions.some((condition) => normalizeText(condition.label).includes(normalizedRequest));
}

function buildProfileMarkers(profile: PatientProfileSummary): ProfileMarkers {
  return {
    activeConditionCount: profile.activeConditions.length,
    careTaskCount: profile.careTasks.length,
    upcomingVisitCount: profile.upcomingVisits.length
  };
}

function formatConditionSources(medicalContext: ConditionKnowledge): string {
  const sourceNames = medicalContext.sources?.map((source) => source.sourceName) ?? [];
  return sourceNames.length > 0 ? sourceNames.join(", ") : "Your care team";
}

function buildConditionExplanation(condition: ProfileCondition, medicalContext: ConditionKnowledge | null): string {
  if (medicalContext) {
    return `**${condition.label}**\n- What it means: ${medicalContext.whatItMeans}\n- Why it matters: ${medicalContext.why_it_matters}\n- Source: ${formatConditionSources(medicalContext)}`;
  }
  
  return `${condition.label}: your active profile shows this as an ongoing health condition that your care team is monitoring over time.`;
}

function buildNoConditionFallback(profile: PatientProfileSummary): string {
  return `I checked your active profile for ${profile.patientId}, and there are no active conditions listed right now. I can only explain conditions already documented in your profile, and I cannot diagnose new conditions in chat.`;
}

function buildUnknownConditionBoundary(requestedCondition: string): string {
  return `I can explain conditions already listed in your active profile, but I do not see '${requestedCondition}' in your current condition list. I cannot confirm or diagnose new conditions in chat. If this concern is new, please contact your care team.`;
}

function buildLinkedConditionMessage(profile: PatientProfileSummary, conditionContexts: Map<string, ConditionKnowledge | null>): string {
  const conditionDetails = profile.activeConditions.map((condition) => {
    const context = conditionContexts.get(condition.label);
    if (context) {
      return `- ${buildConditionExplanation(condition, context)}`;
    }
    return `- ${condition.label}`;
  });

  return [
    `**Based on your active profile for ${profile.patientId}, here are your current conditions:**\n`,
    conditionDetails.join("\n\n"),
    `\nProfile markers: ${profile.activeConditions.length} active condition(s), ${profile.careTasks.length} care task(s), ${profile.upcomingVisits.length} upcoming visit(s).`,
    "\nEach is an ongoing condition that your care team is monitoring. Ask me to explain any of these in simpler terms if helpful."
  ].join("\n");
}

function buildSpecificConditionMessage(
  condition: ProfileCondition,
  medicalContext: ConditionKnowledge | null
): string {
  if (medicalContext) {
    const parts = [
      `**${condition.label}**`,
      ``,
      `**What it means:**`,
      medicalContext.whatItMeans || "This is an ongoing health condition listed in your profile.",
      ``,
      `**Why it matters:**`,
      medicalContext.why_it_matters || "Your care team is monitoring this condition to keep you healthy.",
    ];

    if (medicalContext.whatToMonitor && medicalContext.whatToMonitor.length > 0) {
      parts.push(``);
      parts.push(`**What to monitor:**`);
      medicalContext.whatToMonitor.forEach(item => parts.push(`• ${item}`));
    }

    if (medicalContext.lifestyle_tips && medicalContext.lifestyle_tips.length > 0) {
      parts.push(``);
      parts.push(`**Things that can help:**`);
      medicalContext.lifestyle_tips.forEach(tip => parts.push(`${tip}`));
    }

    if (medicalContext.reassurance) {
      parts.push(``);
      parts.push(`**Good news:**`);
      parts.push(medicalContext.reassurance);
    }

    parts.push(``);
    parts.push(`*Information source: ${formatConditionSources(medicalContext)}*`);
    parts.push(`*Ask your care team any specific questions about your care.*`);

    return parts.join("\n");
  }

  return `${condition.label}: This is an ongoing health condition that your care team is monitoring. For more information about this condition, please ask your care team or request additional resources.`;
}

export async function buildConditionGuidance(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): Promise<ConditionGuidanceResult> {
  const profileMarkers = buildProfileMarkers(profile);

  if (!hasConditionIntent(message)) {
    return {
      isConditionIntent: false,
      assistantMessage: null,
      conditionsUsed: [],
      unknownRequestedCondition: null,
      profileMarkers,
      contextSourceRefs: []
    };
  }

  if (profile.activeConditions.length === 0) {
    return {
      isConditionIntent: true,
      assistantMessage: buildNoConditionFallback(profile),
      conditionsUsed: [],
      unknownRequestedCondition: null,
      profileMarkers,
      contextSourceRefs: [contextSnapshotRef]
    };
  }

  const requestedCondition = extractRequestedCondition(message);
  
  // If specific condition requested, check if it's in the profile
  if (requestedCondition) {
    if (!isConditionLinkedToProfile(requestedCondition, profile.activeConditions)) {
      return {
        isConditionIntent: true,
        assistantMessage: buildUnknownConditionBoundary(requestedCondition),
        conditionsUsed: profile.activeConditions.map(toConditionContext),
        unknownRequestedCondition: requestedCondition,
        profileMarkers,
        contextSourceRefs: [contextSnapshotRef]
      };
    }

    // Find the matching condition and get detailed context
    const matchedCondition = profile.activeConditions.find(
      (condition) => normalizeText(condition.label).includes(normalizeText(requestedCondition))
    );

    if (matchedCondition) {
      const context = await getConditionContext(matchedCondition.label);
      return {
        isConditionIntent: true,
        assistantMessage: buildSpecificConditionMessage(matchedCondition, context),
        conditionsUsed: [matchedCondition].map(toConditionContext),
        unknownRequestedCondition: null,
        profileMarkers,
        contextSourceRefs: [contextSnapshotRef]
      };
    }
  }

  // If no specific condition requested, list all conditions
  const conditionContexts = new Map<string, ConditionKnowledge | null>();
  const contextPromises = profile.activeConditions.map(async (condition) => {
    const context = await getConditionContext(condition.label);
    conditionContexts.set(condition.label, context);
  });

  await Promise.all(contextPromises);

  return {
    isConditionIntent: true,
    assistantMessage: buildLinkedConditionMessage(profile, conditionContexts),
    conditionsUsed: profile.activeConditions.map(toConditionContext),
    unknownRequestedCondition: null,
    profileMarkers,
    contextSourceRefs: [contextSnapshotRef]
  };
}
