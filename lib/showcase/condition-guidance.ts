import type { PatientProfileSummary, ProfileCondition } from "@/lib/showcase/profile-summary";

const CONDITION_INTENT_PATTERN =
  /\b(condition|conditions|diagnosis|diagnosed|disease|illness|symptom|symptoms|fever|cough|pain|headache|nausea|explain|what is)\b/i;

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
  return CONDITION_INTENT_PATTERN.test(message);
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

function buildConditionExplanation(condition: ProfileCondition): string {
  return `${condition.label}: your active profile shows this as an ongoing health condition. In plain language, it means this is something your care team is monitoring over time.`;
}

function buildNoConditionFallback(profile: PatientProfileSummary): string {
  return `I checked your active profile for ${profile.patientId}, and there are no active conditions listed right now. I can only explain conditions already documented in your profile, and I cannot diagnose new conditions in chat.`;
}

function buildUnknownConditionBoundary(requestedCondition: string): string {
  return `I can explain conditions already listed in your active profile, but I do not see '${requestedCondition}' in your current condition list. I cannot confirm or diagnose new conditions in chat. If this concern is new, please contact your care team.`;
}

function buildLinkedConditionMessage(profile: PatientProfileSummary): string {
  const lines = profile.activeConditions.map((condition) => `- ${buildConditionExplanation(condition)}`);

  return [
    `Based on your active profile for ${profile.patientId}, here are your current conditions in plain language:`,
    ...lines,
    `Profile markers: ${profile.activeConditions.length} active condition(s), ${profile.careTasks.length} care task(s), ${profile.upcomingVisits.length} upcoming visit(s).`,
    "I can explain any one of these in more detail using simpler language if you want."
  ].join("\n");
}

export function buildConditionGuidance(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): ConditionGuidanceResult {
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
  if (requestedCondition && !isConditionLinkedToProfile(requestedCondition, profile.activeConditions)) {
    return {
      isConditionIntent: true,
      assistantMessage: buildUnknownConditionBoundary(requestedCondition),
      conditionsUsed: profile.activeConditions.map(toConditionContext),
      unknownRequestedCondition: requestedCondition,
      profileMarkers,
      contextSourceRefs: [contextSnapshotRef]
    };
  }

  return {
    isConditionIntent: true,
    assistantMessage: buildLinkedConditionMessage(profile),
    conditionsUsed: profile.activeConditions.map(toConditionContext),
    unknownRequestedCondition: null,
    profileMarkers,
    contextSourceRefs: [contextSnapshotRef]
  };
}
