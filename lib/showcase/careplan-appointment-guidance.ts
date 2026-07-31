import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

type GuidanceIntent = "appointment" | "care-plan" | "appointment-care-plan";

export type CarePlanAppointmentGuidanceResult = {
  isIntentMatch: boolean;
  intent: GuidanceIntent | null;
  assistantMessage: string | null;
  contextSourceRefs: string[];
  usedVisitIds: string[];
  usedCareTaskIds: string[];
  missingScheduleData: boolean;
  missingTaskData: boolean;
};

const APPOINTMENT_INTENT_PATTERN =
  /\b(appointment|appointments|visit|visits|schedule|scheduled|next visit|next appointment|when is)\b/i;

const CARE_PLAN_INTENT_PATTERN =
  /\b(care plan|careplan|care task|care tasks|care activity|my plan|task list|care follow up|care follow-up)\b/i;

function hasAppointmentIntent(message: string): boolean {
  return APPOINTMENT_INTENT_PATTERN.test(message);
}

function hasCarePlanIntent(message: string): boolean {
  return CARE_PLAN_INTENT_PATTERN.test(message);
}

function resolveIntent(message: string): GuidanceIntent | null {
  const appointment = hasAppointmentIntent(message);
  const carePlan = hasCarePlanIntent(message);

  if (appointment && carePlan) {
    return "appointment-care-plan";
  }

  if (appointment) {
    return "appointment";
  }

  if (carePlan) {
    return "care-plan";
  }

  return null;
}

function normalizeStart(value: string | null): string {
  return value ?? "date/time not recorded";
}

function buildAppointmentSection(profile: PatientProfileSummary): { message: string; usedVisitIds: string[]; missing: boolean } {
  if (profile.upcomingVisits.length === 0) {
    return {
      message:
        "I checked your active profile and there are no upcoming visits listed right now. If this seems out of date, please confirm your profile or check with your care team.",
      usedVisitIds: [],
      missing: true
    };
  }

  const orderedVisits = [...profile.upcomingVisits].sort((left, right) =>
    (left.start ?? "").localeCompare(right.start ?? "")
  );

  const lines = orderedVisits.slice(0, 3).map((visit) =>
    `- Visit ${visit.encounterId}: ${normalizeStart(visit.start)} (${visit.status}).`
  );

  return {
    message: [
      "Based on your active profile, here are your upcoming visit details:",
      ...lines
    ].join("\n"),
    usedVisitIds: orderedVisits.map((visit) => visit.encounterId),
    missing: false
  };
}

function buildCarePlanSection(profile: PatientProfileSummary): { message: string; usedCareTaskIds: string[]; missing: boolean } {
  if (profile.careTasks.length === 0) {
    return {
      message:
        "I checked your active profile and there are no care plan tasks listed right now. If you expected a task list, please verify with your care team.",
      usedCareTaskIds: [],
      missing: true
    };
  }

  const lines = profile.careTasks.slice(0, 5).map((task) =>
    `- ${task.description} (${task.status}).`
  );

  return {
    message: [
      "Based on your active profile, here are your care plan tasks:",
      ...lines
    ].join("\n"),
    usedCareTaskIds: profile.careTasks.map((task) => task.carePlanId),
    missing: false
  };
}

export function buildCarePlanAppointmentGuidance(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): CarePlanAppointmentGuidanceResult {
  const intent = resolveIntent(message);
  if (!intent) {
    return {
      isIntentMatch: false,
      intent: null,
      assistantMessage: null,
      contextSourceRefs: [],
      usedVisitIds: [],
      usedCareTaskIds: [],
      missingScheduleData: false,
      missingTaskData: false
    };
  }

  const appointmentSection = buildAppointmentSection(profile);
  const carePlanSection = buildCarePlanSection(profile);

  if (intent === "appointment") {
    return {
      isIntentMatch: true,
      intent,
      assistantMessage: appointmentSection.message,
      contextSourceRefs: [contextSnapshotRef],
      usedVisitIds: appointmentSection.usedVisitIds,
      usedCareTaskIds: [],
      missingScheduleData: appointmentSection.missing,
      missingTaskData: false
    };
  }

  if (intent === "care-plan") {
    return {
      isIntentMatch: true,
      intent,
      assistantMessage: carePlanSection.message,
      contextSourceRefs: [contextSnapshotRef],
      usedVisitIds: [],
      usedCareTaskIds: carePlanSection.usedCareTaskIds,
      missingScheduleData: false,
      missingTaskData: carePlanSection.missing
    };
  }

  return {
    isIntentMatch: true,
    intent,
    assistantMessage: [appointmentSection.message, carePlanSection.message].join("\n\n"),
    contextSourceRefs: [contextSnapshotRef],
    usedVisitIds: appointmentSection.usedVisitIds,
    usedCareTaskIds: carePlanSection.usedCareTaskIds,
    missingScheduleData: appointmentSection.missing,
    missingTaskData: carePlanSection.missing
  };
}
