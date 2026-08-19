import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

export type DiagnosisIntentSignal =
  | "diagnosis_keyword"
  | "self_diagnosis_question"
  | "diagnosis_confirmation_request";

export type DiagnosisIntentRule = {
  ruleId: string;
  signal: DiagnosisIntentSignal;
  phrases: string[];
};

export type DiagnosisIntentRuleSet = {
  ruleSetVersion: string;
  rules: DiagnosisIntentRule[];
  suppressionPhrases: string[];
};

export type DiagnosisBoundaryTemplate = {
  templateVersion: string;
  templateId: string;
  handoff: {
    careTeamContactRequired: boolean;
    escalationGuidance: string;
  };
};

export const DEFAULT_DIAGNOSIS_RULE_SET: DiagnosisIntentRuleSet = {
  ruleSetVersion: "diagnosis-intent.v1",
  rules: [
    {
      ruleId: "DX-RULE-001",
      signal: "diagnosis_keyword",
      phrases: ["diagnose", "diagnosis", "diagnostic"]
    },
    {
      ruleId: "DX-RULE-002",
      signal: "self_diagnosis_question",
      phrases: ["do i have", "what do i have", "am i sick", "could this be"]
    },
    {
      ruleId: "DX-RULE-003",
      signal: "diagnosis_confirmation_request",
      phrases: ["confirm diagnosis", "confirm if i have", "can you confirm", "is it cancer", "is it diabetes"]
    }
  ],
  suppressionPhrases: [
    "appointment",
    "appointments",
    "visit",
    "visits",
    "schedule",
    "scheduled",
    "care plan",
    "care task",
    "care tasks",
    "medication",
    "medications",
    "meds",
    "what is",
    "what does",
    "tell me about",
    "describe",
    "explain",
    "define",
    "what drug",
    "which medication",
    "how does"
  ]
};

export const DIAGNOSIS_BOUNDARY_TEMPLATE: DiagnosisBoundaryTemplate = {
  templateVersion: "diagnosis-boundary-template.v1",
  templateId: "DX-BOUNDARY-001",
  handoff: {
    careTeamContactRequired: true,
    escalationGuidance:
      "For severe or rapidly worsening symptoms, seek urgent in-person care or emergency services immediately."
  }
};

export type DiagnosisBoundaryResult = {
  isDiagnosisIntent: boolean;
  assistantMessage: string | null;
  contextSourceRefs: string[];
  matchedSignals: DiagnosisIntentSignal[];
  matchedRuleIds: string[];
  ruleSetVersion: string | null;
  templateVersion: string | null;
  templateId: string | null;
  triggerReason: "diagnosis_intent_match" | null;
  handoff: DiagnosisBoundaryTemplate["handoff"] | null;
};

function normalizeText(message: string): string {
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesPhrase(normalizedMessage: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) {
    return false;
  }

  return ` ${normalizedMessage} `.includes(` ${normalizedPhrase} `);
}

function classifyDiagnosisIntent(
  message: string,
  ruleSet: DiagnosisIntentRuleSet
): { matchedSignals: DiagnosisIntentSignal[]; matchedRuleIds: string[] } {
  const normalized = normalizeText(message);

  for (const suppressedPhrase of ruleSet.suppressionPhrases) {
    if (includesPhrase(normalized, suppressedPhrase)) {
      return {
        matchedSignals: [],
        matchedRuleIds: []
      };
    }
  }

  const signalSet = new Set<DiagnosisIntentSignal>();
  const ruleIds: string[] = [];

  for (const rule of ruleSet.rules) {
    const hasMatch = rule.phrases.some((phrase) => includesPhrase(normalized, phrase));
    if (!hasMatch) {
      continue;
    }

    signalSet.add(rule.signal);
    ruleIds.push(rule.ruleId);
  }

  return {
    matchedSignals: Array.from(signalSet),
    matchedRuleIds: ruleIds
  };
}

function buildDiagnosisBoundaryMessage(profile: PatientProfileSummary): string {
  return [
    "I cannot diagnose new conditions in chat, and I cannot confirm a diagnosis from symptoms alone.",
    `I can explain conditions already listed in your active profile for ${profile.patientId}.`,
    "Please contact your care team now for an in-person clinical assessment.",
    DIAGNOSIS_BOUNDARY_TEMPLATE.handoff.escalationGuidance
  ].join(" ");
}

export function buildDiagnosisBoundary(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string,
  ruleSet: DiagnosisIntentRuleSet = DEFAULT_DIAGNOSIS_RULE_SET
): DiagnosisBoundaryResult {
  const classification = classifyDiagnosisIntent(message, ruleSet);
  if (classification.matchedRuleIds.length === 0) {
    return {
      isDiagnosisIntent: false,
      assistantMessage: null,
      contextSourceRefs: [],
      matchedSignals: [],
      matchedRuleIds: [],
      ruleSetVersion: null,
      templateVersion: null,
      templateId: null,
      triggerReason: null,
      handoff: null
    };
  }

  return {
    isDiagnosisIntent: true,
    assistantMessage: buildDiagnosisBoundaryMessage(profile),
    contextSourceRefs: [contextSnapshotRef],
    matchedSignals: classification.matchedSignals,
    matchedRuleIds: classification.matchedRuleIds,
    ruleSetVersion: ruleSet.ruleSetVersion,
    templateVersion: DIAGNOSIS_BOUNDARY_TEMPLATE.templateVersion,
    templateId: DIAGNOSIS_BOUNDARY_TEMPLATE.templateId,
    triggerReason: "diagnosis_intent_match",
    handoff: DIAGNOSIS_BOUNDARY_TEMPLATE.handoff
  };
}
