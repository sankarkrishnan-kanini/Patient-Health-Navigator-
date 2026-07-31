import type { PatientProfileSummary, ProfileMedication } from "@/lib/showcase/profile-summary";

const MEDICATION_INTENT_PATTERN =
  /\b(medication|medications|medicine|meds|pill|pills|prescription|prescriptions|take|taking|dose|dosing|schedule)\b/i;

type MedicationContext = {
  name: string;
  schedule: string | null;
  purpose: string | null;
};

export type MedicationGuidanceResult = {
  isMedicationIntent: boolean;
  assistantMessage: string | null;
  medicationsUsed: MedicationContext[];
  missingDetailMedicationIds: string[];
  contextSourceRefs: string[];
};

function hasMedicationIntent(message: string): boolean {
  return MEDICATION_INTENT_PATTERN.test(message);
}

function toContextMedication(medication: ProfileMedication): MedicationContext {
  return {
    name: medication.name,
    schedule: medication.schedule,
    purpose: medication.purpose
  };
}

function safeField(value: string | null, fallback: string): string {
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value;
}

function hasMissingDetail(medication: ProfileMedication): boolean {
  return !medication.schedule || !medication.purpose;
}

function buildGroundedMedicationMessage(profile: PatientProfileSummary): string {
  if (profile.activeMedications.length === 0) {
    return "I checked your active profile and there are no active medications listed right now. If this seems out of date, confirm your profile or ask your care team to review your medication list.";
  }

  const lines = profile.activeMedications.map((medication) => {
    const schedule = safeField(medication.schedule, "schedule not recorded");
    const purpose = safeField(medication.purpose, "purpose not recorded");
    return `- ${medication.name}: schedule ${schedule}; purpose ${purpose}.`;
  });

  const hasMissingDetails = profile.activeMedications.some((medication) => hasMissingDetail(medication));
  const missingDetailNote = hasMissingDetails
    ? "Some medication details are missing from the current profile snapshot, so I cannot add assumptions beyond what is listed."
    : null;

  return [
    "Based on your active profile, here are your listed medications:",
    ...lines,
    ...(missingDetailNote ? [missingDetailNote] : []),
    "I can explain any one of these in simpler terms if you want."
  ].join("\n");
}

export function buildMedicationGuidance(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): MedicationGuidanceResult {
  if (!hasMedicationIntent(message)) {
    return {
      isMedicationIntent: false,
      assistantMessage: null,
      medicationsUsed: [],
      missingDetailMedicationIds: [],
      contextSourceRefs: []
    };
  }

  const missingDetailMedicationIds = profile.activeMedications
    .filter((medication) => hasMissingDetail(medication))
    .map((medication) => medication.medicationId);

  return {
    isMedicationIntent: true,
    assistantMessage: buildGroundedMedicationMessage(profile),
    medicationsUsed: profile.activeMedications.map(toContextMedication),
    missingDetailMedicationIds,
    contextSourceRefs: [contextSnapshotRef]
  };
}
