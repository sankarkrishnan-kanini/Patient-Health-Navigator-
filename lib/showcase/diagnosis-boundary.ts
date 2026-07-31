import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const DIAGNOSIS_INTENT_PATTERN =
  /\b(diagnose|diagnosis|do i have|what do i have|am i sick|is this|confirm)\b/i;

const NON_DIAGNOSIS_CONTEXT_PATTERN =
  /\b(appointment|appointments|visit|visits|schedule|scheduled|care plan|care task|care tasks|medication|medications|meds)\b/i;

export type DiagnosisBoundaryResult = {
  isDiagnosisIntent: boolean;
  assistantMessage: string | null;
  contextSourceRefs: string[];
  matchedSignals: string[];
};

function matchedSignals(message: string): string[] {
  const lower = message.toLowerCase();
  const signals: string[] = [];

  if (lower.includes("diagnose") || lower.includes("diagnosis")) {
    signals.push("diagnosis_keyword");
  }

  if (lower.includes("do i have") || lower.includes("what do i have")) {
    signals.push("self_diagnosis_question");
  }

  if (lower.includes("confirm")) {
    signals.push("diagnosis_confirmation_request");
  }

  return signals;
}

function buildDiagnosisBoundaryMessage(profile: PatientProfileSummary): string {
  return [
    "I cannot diagnose new conditions in chat, and I cannot confirm a diagnosis from symptoms alone.",
    `I can explain conditions already listed in your active profile for ${profile.patientId}.`,
    "If you are worried about a new problem, please contact your care team for an in-person assessment."
  ].join(" ");
}

export function buildDiagnosisBoundary(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): DiagnosisBoundaryResult {
  if (!DIAGNOSIS_INTENT_PATTERN.test(message) || NON_DIAGNOSIS_CONTEXT_PATTERN.test(message)) {
    return {
      isDiagnosisIntent: false,
      assistantMessage: null,
      contextSourceRefs: [],
      matchedSignals: []
    };
  }

  return {
    isDiagnosisIntent: true,
    assistantMessage: buildDiagnosisBoundaryMessage(profile),
    contextSourceRefs: [contextSnapshotRef],
    matchedSignals: matchedSignals(message)
  };
}
