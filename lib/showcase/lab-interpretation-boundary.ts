export type LabBoundaryRule = {
  ruleId: string;
  phrases: string[];
};

export type LabBoundaryRuleSet = {
  ruleSetVersion: string;
  rules: LabBoundaryRule[];
};

export type LabJudgmentPhraseRuleSet = {
  ruleSetVersion: string;
  prohibitedPhrases: string[];
};

export type LabJudgmentGuardResult = {
  safeMessage: string;
  blockedPhrases: string[];
  correctionPath: "none" | "rewrite_safe_fallback";
};

export type LabInterpretationBoundaryResult = {
  isLabInterpretationIntent: boolean;
  assistantMessage: string | null;
  ruleSetVersion: string | null;
  matchedRuleIds: string[];
  triggerReason: "lab_interpretation_request" | null;
  contextSourceRefs: string[];
  prohibitedPhraseRuleSetVersion: string | null;
  blockedPhrases: string[];
  correctionPath: "none" | "rewrite_safe_fallback" | null;
};

export const DEFAULT_LAB_BOUNDARY_RULE_SET: LabBoundaryRuleSet = {
  ruleSetVersion: "lab-boundary.v1",
  rules: [
    {
      ruleId: "LAB-BOUNDARY-001",
      phrases: [
        "interpret my lab",
        "interpret my labs",
        "interpret my blood test",
        "interpret this lab",
        "what do my lab results mean",
        "are my lab results normal",
        "is my a1c high",
        "is my cholesterol high",
        "are these results abnormal",
        "what does my blood test mean"
      ]
    }
  ]
};

export const DEFAULT_LAB_JUDGMENT_PHRASE_RULE_SET: LabJudgmentPhraseRuleSet = {
  ruleSetVersion: "lab-judgment-phrases.v1",
  prohibitedPhrases: [
    "normal",
    "abnormal",
    "high",
    "low",
    "critical",
    "concerning",
    "reassuring",
    "safe range",
    "out of range"
  ]
};

const SAFE_LAB_BOUNDARY_TEMPLATE =
  "I cannot interpret lab results or provide clinical judgment in chat. Please contact your care team for personalized interpretation of your lab report. If symptoms are worsening, seek urgent in-person care.";

function normalizeText(text: string): string {
  return text
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

export function applyLabJudgmentPhraseGuard(
  candidateMessage: string,
  phraseRuleSet: LabJudgmentPhraseRuleSet = DEFAULT_LAB_JUDGMENT_PHRASE_RULE_SET
): LabJudgmentGuardResult {
  const normalized = normalizeText(candidateMessage);
  const blockedPhrases = phraseRuleSet.prohibitedPhrases.filter((phrase) =>
    includesPhrase(normalized, phrase)
  );

  if (blockedPhrases.length === 0) {
    return {
      safeMessage: candidateMessage,
      blockedPhrases: [],
      correctionPath: "none"
    };
  }

  return {
    safeMessage: SAFE_LAB_BOUNDARY_TEMPLATE,
    blockedPhrases,
    correctionPath: "rewrite_safe_fallback"
  };
}

export function buildLabInterpretationBoundary(
  message: string,
  contextSnapshotRef: string,
  ruleSet: LabBoundaryRuleSet = DEFAULT_LAB_BOUNDARY_RULE_SET,
  phraseRuleSet: LabJudgmentPhraseRuleSet = DEFAULT_LAB_JUDGMENT_PHRASE_RULE_SET
): LabInterpretationBoundaryResult {
  const normalizedMessage = normalizeText(message);
  const matchedRuleIds = ruleSet.rules
    .filter((rule) => rule.phrases.some((phrase) => includesPhrase(normalizedMessage, phrase)))
    .map((rule) => rule.ruleId);

  if (matchedRuleIds.length === 0) {
    return {
      isLabInterpretationIntent: false,
      assistantMessage: null,
      ruleSetVersion: null,
      matchedRuleIds: [],
      triggerReason: null,
      contextSourceRefs: [],
      prohibitedPhraseRuleSetVersion: null,
      blockedPhrases: [],
      correctionPath: null
    };
  }

  const guard = applyLabJudgmentPhraseGuard(SAFE_LAB_BOUNDARY_TEMPLATE, phraseRuleSet);

  return {
    isLabInterpretationIntent: true,
    assistantMessage: guard.safeMessage,
    ruleSetVersion: ruleSet.ruleSetVersion,
    matchedRuleIds,
    triggerReason: "lab_interpretation_request",
    contextSourceRefs: [contextSnapshotRef],
    prohibitedPhraseRuleSetVersion: phraseRuleSet.ruleSetVersion,
    blockedPhrases: guard.blockedPhrases,
    correctionPath: guard.correctionPath
  };
}
