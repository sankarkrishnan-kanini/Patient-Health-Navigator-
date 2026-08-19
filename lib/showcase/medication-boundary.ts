import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

export type MedicationBoundaryCategory =
  | "dosage-change"
  | "stop-change"
  | "dosage-and-stop-change"
  | "dosage-instruction";

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
    },
    {
      ruleId: "MED-BOUNDARY-DOSAGE-INSTRUCTION-001",
      category: "dosage-instruction",
      phrases: [
        "what dosage",
        "what dose",
        "how much should i take",
        "how many pills",
        "how many tablets",
        "how many capsules",
        "how often should i take",
        "how often do i take",
        "what time should i take",
        "when should i take",
        "what is the dosage",
        "what is the dose",
        "what is the frequency",
        "what is the schedule",
        "how many mg",
        "what strength",
        "what amount"
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

function hasNumericDosageChoice(normalizedMessage: string): boolean {
  return (
    /\b(?:should|can) i take \d+ (?:or|to) \d+\b/.test(normalizedMessage) ||
    /\b(?:should|can) i take \d+ times (?:a|per) day\b/.test(normalizedMessage)
  );
}

function buildMedicationBoundaryMessage(
  profile: PatientProfileSummary,
  category: MedicationBoundaryCategory
): string {
  let categoryLine: string;

  if (category === "dosage-change") {
    categoryLine = "I cannot provide dosage change instructions in chat.";
  } else if (category === "stop-change") {
    categoryLine = "I cannot advise stopping or switching medication in chat.";
  } else if (category === "dosage-instruction") {
    categoryLine = "Your medication dosage and schedule are prescribed by your care team specifically for you. I can only explain what medications are, not provide dosage instructions.";
  } else {
    categoryLine = "I cannot provide dosage change or stop/switch medication instructions in chat.";
  }

  const listedMeds = profile.activeMedications.length
    ? `Your active profile currently lists: ${profile.activeMedications
        .map((medication) => medication.name)
        .join(", ")}.`
    : "Your active profile currently has no medications listed.";

  const dosageNote = category === "dosage-instruction"
    ? "Check your prescription label or packaging for your specific dose and schedule."
    : "Please contact your care team now before making any medication changes.";

  return [
    categoryLine,
    dosageNote,
    listedMeds,
    category === "dosage-instruction"
      ? "I can explain what each medication does and why it's prescribed, but dosage decisions are between you and your care team."
      : "I can explain what your current medication list says, but I cannot give treatment directives."
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

  if (hasNumericDosageChoice(normalizedMessage)) {
    const dosageInstructionRule = ruleSet.rules.find(
      (rule) => rule.ruleId === "MED-BOUNDARY-DOSAGE-INSTRUCTION-001"
    );
    if (dosageInstructionRule && !matchedRules.includes(dosageInstructionRule)) {
      matchedRules.push(dosageInstructionRule);
    }
  }

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
  const hasDosageInstruction = matchedRules.some((rule) => rule.category === "dosage-instruction");

  let category: MedicationBoundaryCategory;
  
  if (hasDosageInstruction) {
    category = "dosage-instruction";
  } else if (hasDose && hasStop) {
    category = "dosage-and-stop-change";
  } else if (hasDose) {
    category = "dosage-change";
  } else {
    category = "stop-change";
  }

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
