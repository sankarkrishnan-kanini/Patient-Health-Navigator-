import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

export type MedicationBoundaryCategory =
  | "dosage-change"
  | "stop-change"
  | "dosage-and-stop-change";

export type MedicationBoundaryRule = {
  ruleId: string;
  category: MedicationBoundaryCategory;
  phrases: string[];
};

export type MedicationBoundaryRuleSet = {
  ruleSetVersion: string;
  rules: MedicationBoundaryRule[];
};

export type MedicationBoundaryResult = {
  isMedicationBoundary: boolean;
  assistantMessage: string | null;
  category: MedicationBoundaryCategory | null;
  ruleSetVersion: string | null;
  matchedRuleIds: string[];
  triggerReason: "medication_dose_or_stop_request" | null;
  contextSourceRefs: string[];
};

export const DEFAULT_MEDICATION_BOUNDARY_RULE_SET: MedicationBoundaryRuleSet = {
  ruleSetVersion: "medication-boundary.v1",
  rules: [
    {
      ruleId: "MED-BOUNDARY-DOSE-001",
      category: "dosage-change",
      phrases: [
        "change my dose",
        "increase my dose",
        "decrease my dose",
        "adjust my dose",
        "raise the dose",
        "lower the dose",
        "double my medication",
        "halve my medication"
      ]
    },
    {
      ruleId: "MED-BOUNDARY-STOP-001",
      category: "stop-change",
      phrases: [
        "stop taking",
        "should i stop",
        "can i stop",
        "quit taking",
        "switch medication",
        "change my medication",
        "replace my medication",
        "skip my medication"
      ]
    }
  ]
};

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

function buildMedicationBoundaryMessage(
  profile: PatientProfileSummary,
  category: MedicationBoundaryCategory
): string {
  const categoryLine =
    category === "dosage-change"
      ? "I cannot provide dosage change instructions in chat."
      : category === "stop-change"
        ? "I cannot advise stopping or switching medication in chat."
        : "I cannot provide dosage change or stop/switch medication instructions in chat.";

  const listedMeds = profile.activeMedications.length
    ? `Your active profile currently lists: ${profile.activeMedications
        .map((medication) => medication.name)
        .join(", ")}.`
    : "Your active profile currently has no medications listed.";

  return [
    categoryLine,
    "Please contact your care team now before making any medication changes.",
    listedMeds,
    "I can explain what your current medication list says, but I cannot give treatment directives."
  ].join(" ");
}

export function buildMedicationBoundary(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string,
  ruleSet: MedicationBoundaryRuleSet = DEFAULT_MEDICATION_BOUNDARY_RULE_SET
): MedicationBoundaryResult {
  const normalizedMessage = normalizeText(message);
  const matchedRules = ruleSet.rules.filter((rule) =>
    rule.phrases.some((phrase) => includesPhrase(normalizedMessage, phrase))
  );

  if (matchedRules.length === 0) {
    return {
      isMedicationBoundary: false,
      assistantMessage: null,
      category: null,
      ruleSetVersion: null,
      matchedRuleIds: [],
      triggerReason: null,
      contextSourceRefs: []
    };
  }

  const hasDose = matchedRules.some((rule) => rule.category === "dosage-change");
  const hasStop = matchedRules.some((rule) => rule.category === "stop-change");
  const category: MedicationBoundaryCategory = hasDose && hasStop
    ? "dosage-and-stop-change"
    : hasDose
      ? "dosage-change"
      : "stop-change";

  return {
    isMedicationBoundary: true,
    assistantMessage: buildMedicationBoundaryMessage(profile, category),
    category,
    ruleSetVersion: ruleSet.ruleSetVersion,
    matchedRuleIds: matchedRules.map((rule) => rule.ruleId),
    triggerReason: "medication_dose_or_stop_request",
    contextSourceRefs: [contextSnapshotRef]
  };
}
