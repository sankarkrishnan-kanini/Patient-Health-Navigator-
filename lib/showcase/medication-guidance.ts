import type { PatientProfileSummary, ProfileMedication } from "@/lib/showcase/profile-summary";
import {
  performRxNormLookup,
  buildInteractionWarningMessage,
  type MedicationInteractionCheck
} from "@/lib/showcase/rxnorm-lookup";
import {
  getMedicationContext,
  type MedicationKnowledge
} from "@/lib/showcase/medical-knowledge-base";

const MEDICATION_INTENT_PATTERN =
  /\b(medication|medications|medicine|meds|pill|pills|prescription|prescriptions|take|taking|dose|dosing|schedule|what is)\b/i;

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
  interactionWarnings: MedicationInteractionCheck[];
  interactionWarningMessage: string | null;
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

function extractRequestedMedication(message: string): string | null {
  const normalized = message
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const matcher = /(?:what is|explain|about|tell me about)\s+([a-z0-9\s-]{3,100})/.exec(normalized);
  if (!matcher?.[1]) {
    return null;
  }

  const candidate = matcher[1]
    .replace(/\b(medication|medicine|pill|please|for me)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return candidate.length > 2 ? candidate : null;
}

function isMedicationLinkedToProfile(
  requestedMed: string,
  activeMedications: ProfileMedication[]
): boolean {
  const normalizedRequest = requestedMed.toLowerCase();
  return activeMedications.some((med) =>
    med.name.toLowerCase().includes(normalizedRequest) ||
    normalizedRequest.split(/\s+/).every(word =>
      med.name.toLowerCase().includes(word)
    )
  );
}

function buildSpecificMedicationMessage(
  medication: ProfileMedication,
  medicalContext: MedicationKnowledge | null
): string {
  const schedule = medication.schedule || "as prescribed by your care team";
  const purpose = medication.purpose || "as directed by your care team";

  const parts = [
    `**${medication.name}**`,
    ``,
    `**How often to take it:**`,
    schedule,
    ``,
    `**Why you take it:**`,
    purpose,
  ];

  if (medicalContext) {
    if (medicalContext.purpose) {
      parts.push(``);
      parts.push(`**What it does in your body:**`);
      parts.push(medicalContext.purpose);
    }

    if (medicalContext.mechanism) {
      parts.push(``);
      parts.push(`**How it works:**`);
      parts.push(medicalContext.mechanism);
    }

    if (medicalContext.commonSideEffects && medicalContext.commonSideEffects.length > 0) {
      parts.push(``);
      parts.push(`**Common side effects to watch for:**`);
      medicalContext.commonSideEffects.slice(0, 3).forEach(effect => {
        parts.push(`• ${effect}`);
      });
    }

    if (medicalContext.safetyNotes && medicalContext.safetyNotes.length > 0) {
      parts.push(``);
      parts.push(`**Important safety information:**`);
      medicalContext.safetyNotes.slice(0, 2).forEach(note => {
        parts.push(`• ${note}`);
      });
    }

    if (medicalContext.interactions && medicalContext.interactions.length > 0) {
      parts.push(``);
      parts.push(`**Watch out for interactions with:**`);
      medicalContext.interactions.slice(0, 2).forEach(interaction => {
        parts.push(`• ${interaction}`);
      });
    }

    parts.push(``);
    parts.push(`*Information source: ${medicalContext.source || "FDA"}*`);
  }

  parts.push(``);
  parts.push(`**If you experience unusual symptoms, tell your care team right away.**`);

  return parts.join("\n");
}

function buildGroundedMedicationMessage(profile: PatientProfileSummary, interactionWarning: string | null, medicationContexts: Map<string, MedicationKnowledge | null>): string {
  if (profile.activeMedications.length === 0) {
    return "I checked your active profile and there are no active medications listed right now. If this seems out of date, confirm your profile or ask your care team to review your medication list.";
  }

  // Build medication details with medical context where available
  const medicationDetails = profile.activeMedications.map((medication) => {
    const schedule = safeField(medication.schedule, "schedule not recorded");
    const purpose = safeField(medication.purpose, "purpose not recorded");
    const medicalContext = medicationContexts.get(medication.name);

    let details = `- **${medication.name}**\n`;
    details += `  • How often: ${schedule}\n`;
    details += `  • Why you take it: ${purpose}`;

    // Add medical context if available from FDA DailyMed API
    if (medicalContext) {
      if (medicalContext.purpose) {
        details += `\n  • What it does: ${medicalContext.purpose}`;
      }
      if (medicalContext.mechanism) {
        details += `\n  • How it works: ${medicalContext.mechanism}`;
      }
      if (medicalContext.commonSideEffects && medicalContext.commonSideEffects.length > 0) {
        details += `\n  • Side effects: ${medicalContext.commonSideEffects.slice(0, 2).join(", ")}`;
      }
      // Add key safety notes (limit to 1-2 most important)
      if (medicalContext.safetyNotes && medicalContext.safetyNotes.length > 0) {
        details += `\n  • ⚠️ Safety: ${medicalContext.safetyNotes[0]}`;
      }
      if (medicalContext.source) {
        details += `\n  • Source: ${medicalContext.source}`;
      }
    }

    return details;
  });

  const hasMissingDetails = profile.activeMedications.some((medication) => hasMissingDetail(medication));
  const missingDetailNote = hasMissingDetails
    ? "\n⚠️ Some medication details are missing from your current profile snapshot."
    : "";

  const baseParts = [
    "**Here are your active medications from your profile:**\n",
    medicationDetails.join("\n\n"),
    missingDetailNote,
    "\n**Next steps:**",
    "• Take medications exactly as prescribed",
    "• Report any unusual side effects to your care team",
    "• Ask me to explain any medication in simpler terms"
  ];

  // Append interaction warnings if present
  if (interactionWarning) {
    baseParts.push("\n" + interactionWarning);
  }

  return baseParts.join("\n");
}

export async function buildMedicationGuidance(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): Promise<MedicationGuidanceResult> {
  if (!hasMedicationIntent(message)) {
    return {
      isMedicationIntent: false,
      assistantMessage: null,
      medicationsUsed: [],
      missingDetailMedicationIds: [],
      contextSourceRefs: [],
      interactionWarnings: [],
      interactionWarningMessage: null
    };
  }

  if (profile.activeMedications.length === 0) {
    return {
      isMedicationIntent: true,
      assistantMessage: "I checked your active profile and there are no active medications listed right now.",
      medicationsUsed: [],
      missingDetailMedicationIds: [],
      contextSourceRefs: [contextSnapshotRef],
      interactionWarnings: [],
      interactionWarningMessage: null
    };
  }

  // Check if user is asking about a specific medication
  const requestedMedication = extractRequestedMedication(message);
  
  if (requestedMedication) {
    if (!isMedicationLinkedToProfile(requestedMedication, profile.activeMedications)) {
      return {
        isMedicationIntent: true,
        assistantMessage: `I can only explain medications already listed in your active profile. I don't see '${requestedMedication}' in your medication list. If you have a new medication, please ask your care team to update your profile.`,
        medicationsUsed: profile.activeMedications.map(toContextMedication),
        missingDetailMedicationIds: [],
        contextSourceRefs: [contextSnapshotRef],
        interactionWarnings: [],
        interactionWarningMessage: null
      };
    }

    // Find the matching medication
    const matchedMedication = profile.activeMedications.find(
      (med) => isMedicationLinkedToProfile(requestedMedication, [med])
    );

    if (matchedMedication) {
      const context = await getMedicationContext(matchedMedication.name);
      return {
        isMedicationIntent: true,
        assistantMessage: buildSpecificMedicationMessage(matchedMedication, context),
        medicationsUsed: [matchedMedication].map(toContextMedication),
        missingDetailMedicationIds: hasMissingDetail(matchedMedication) ? [matchedMedication.medicationId] : [],
        contextSourceRefs: [contextSnapshotRef],
        interactionWarnings: [],
        interactionWarningMessage: null
      };
    }
  }

  // Default: list all medications
  const missingDetailMedicationIds = profile.activeMedications
    .filter((medication) => hasMissingDetail(medication))
    .map((medication) => medication.medicationId);

  // Perform RxNorm lookup and interaction checking
  const medicationNames = profile.activeMedications.map((med) => med.name);
  const rxNormResult = await performRxNormLookup(medicationNames);
  const interactionWarningMessage = buildInteractionWarningMessage(rxNormResult);

  // Fetch medical context from FDA DailyMed API for each medication (in parallel)
  const medicationContexts = new Map<string, MedicationKnowledge | null>();
  const contextPromises = profile.activeMedications.map(async (med) => {
    const context = await getMedicationContext(med.name);
    medicationContexts.set(med.name, context);
  });
  
  await Promise.all(contextPromises);

  return {
    isMedicationIntent: true,
    assistantMessage: buildGroundedMedicationMessage(profile, interactionWarningMessage, medicationContexts),
    medicationsUsed: profile.activeMedications.map(toContextMedication),
    missingDetailMedicationIds,
    contextSourceRefs: [contextSnapshotRef],
    interactionWarnings: rxNormResult.medications,
    interactionWarningMessage
  };
}
