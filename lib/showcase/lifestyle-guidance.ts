import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

type LifestyleIntent = "diet" | "activity" | "habit" | "lifestyle";

export type LifestyleGuidanceResult = {
  isLifestyleIntent: boolean;
  isOutOfScope: boolean;
  intent: LifestyleIntent | null;
  assistantMessage: string | null;
  contextSourceRefs: string[];
  usedConditionIds: string[];
  usedMedicationIds: string[];
  usedCareTaskIds: string[];
  usedVisitIds: string[];
};

const LIFESTYLE_INTENT_PATTERN =
  /\b(diet|eat|eating|food|meal|nutrition|exercise|activity|active|walk|walking|sleep|habit|habits|routine|lifestyle)\b/i;

const DIET_INTENT_PATTERN = /\b(diet|eat|eating|food|meal|nutrition)\b/i;
const ACTIVITY_INTENT_PATTERN = /\b(exercise|activity|active|walk|walking|movement|workout)\b/i;
const HABIT_INTENT_PATTERN = /\b(sleep|habit|habits|routine|alcohol|smoking|stress)\b/i;

const OUT_OF_SCOPE_PATTERN =
  /\b(exact meal plan|7-day meal plan|macro|macros|calorie target|supplement stack|prescribe|prescription|exact workout plan|optimize nutrition)\b/i;

function detectLifestyleIntent(message: string): LifestyleIntent | null {
  if (DIET_INTENT_PATTERN.test(message)) {
    return "diet";
  }

  if (ACTIVITY_INTENT_PATTERN.test(message)) {
    return "activity";
  }

  if (HABIT_INTENT_PATTERN.test(message)) {
    return "habit";
  }

  if (LIFESTYLE_INTENT_PATTERN.test(message)) {
    return "lifestyle";
  }

  return null;
}

function buildOutOfScopeMessage(profile: PatientProfileSummary): string {
  return [
    "I can share general lifestyle guidance linked to your current profile, but I cannot create a personalized medical diet or exercise prescription in chat.",
    `Your active profile for ${profile.patientId} should be reviewed with your care team before you make detailed nutrition or workout changes.`
  ].join(" ");
}

function buildDietMessage(
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): LifestyleGuidanceResult {
  const medicationWithMeals = profile.activeMedications.find((medication) =>
    (medication.schedule ?? "").toLowerCase().includes("meal")
  );
  const careTask = profile.careTasks[0] ?? null;
  const visit = profile.upcomingVisits[0] ?? null;

  const lines = ["Based on your active profile, keep food choices simple and consistent rather than making sudden changes."];

  if (medicationWithMeals) {
    lines.push(
      `${medicationWithMeals.name} is listed as ${medicationWithMeals.schedule}, so try to keep regular meals around that schedule.`
    );
  }

  if (careTask) {
    lines.push(`Your care plan also includes '${careTask.description}', so daily routines should stay aligned with that follow-up.`);
  }

  if (visit) {
    lines.push(`You also have a scheduled visit on ${visit.start ?? "date pending"}, which is a good time to ask for more detailed nutrition advice.`);
  }

  if (!medicationWithMeals && !careTask && !visit) {
    lines.push("I do not see a detailed nutrition plan in your profile, so stick with balanced meals and confirm any major changes with your care team.");
  }

  return {
    isLifestyleIntent: true,
    isOutOfScope: false,
    intent: "diet",
    assistantMessage: lines.join(" "),
    contextSourceRefs: [contextSnapshotRef],
    usedConditionIds: [],
    usedMedicationIds: medicationWithMeals ? [medicationWithMeals.medicationId] : [],
    usedCareTaskIds: careTask ? [careTask.carePlanId] : [],
    usedVisitIds: visit ? [visit.encounterId] : []
  };
}

function buildActivityMessage(
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): LifestyleGuidanceResult {
  const condition = profile.activeConditions[0] ?? null;
  const careTask = profile.careTasks[0] ?? null;
  const visit = profile.upcomingVisits[0] ?? null;

  const lines = ["Based on your active profile, aim for steady, manageable activity instead of sudden high-intensity changes."];

  if (condition) {
    lines.push(`Your profile shows ${condition.label}, so it is safer to build activity gradually and stay within the plan already discussed with your care team.`);
  }

  if (careTask) {
    lines.push(`Your current care task is '${careTask.description}', which should guide how you pace daily activity.`);
  }

  if (visit) {
    lines.push(`You also have an upcoming visit on ${visit.start ?? "date pending"}, so bring up any exercise changes there if you need more specific advice.`);
  }

  if (!condition && !careTask && !visit) {
    lines.push("I do not see a specific activity instruction in your profile, so keep activity moderate and ask your care team before making major changes.");
  }

  return {
    isLifestyleIntent: true,
    isOutOfScope: false,
    intent: "activity",
    assistantMessage: lines.join(" "),
    contextSourceRefs: [contextSnapshotRef],
    usedConditionIds: condition ? [condition.conditionId] : [],
    usedMedicationIds: [],
    usedCareTaskIds: careTask ? [careTask.carePlanId] : [],
    usedVisitIds: visit ? [visit.encounterId] : []
  };
}

function buildHabitMessage(
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): LifestyleGuidanceResult {
  const careTask = profile.careTasks[0] ?? null;
  const medication = profile.activeMedications[0] ?? null;

  const lines = ["Based on your active profile, keep daily habits predictable and easy to follow."];

  if (medication) {
    lines.push(`Your profile lists ${medication.name}${medication.schedule ? ` on a ${medication.schedule} schedule` : ""}, so regular sleep and meal routines can help you stay on track.`);
  }

  if (careTask) {
    lines.push(`Your care plan includes '${careTask.description}', so habits that support that follow-up are the safest place to focus.`);
  }

  if (!medication && !careTask) {
    lines.push("I do not see a specific habit-focused instruction in your profile, so focus on regular sleep, meals, and follow-up with your care team if you want more detailed advice.");
  }

  return {
    isLifestyleIntent: true,
    isOutOfScope: false,
    intent: "habit",
    assistantMessage: lines.join(" "),
    contextSourceRefs: [contextSnapshotRef],
    usedConditionIds: [],
    usedMedicationIds: medication ? [medication.medicationId] : [],
    usedCareTaskIds: careTask ? [careTask.carePlanId] : [],
    usedVisitIds: []
  };
}

export function buildLifestyleGuidance(
  message: string,
  profile: PatientProfileSummary,
  contextSnapshotRef: string
): LifestyleGuidanceResult {
  const intent = detectLifestyleIntent(message);
  if (!intent) {
    return {
      isLifestyleIntent: false,
      isOutOfScope: false,
      intent: null,
      assistantMessage: null,
      contextSourceRefs: [],
      usedConditionIds: [],
      usedMedicationIds: [],
      usedCareTaskIds: [],
      usedVisitIds: []
    };
  }

  if (OUT_OF_SCOPE_PATTERN.test(message)) {
    return {
      isLifestyleIntent: true,
      isOutOfScope: true,
      intent,
      assistantMessage: buildOutOfScopeMessage(profile),
      contextSourceRefs: [contextSnapshotRef],
      usedConditionIds: profile.activeConditions.map((condition) => condition.conditionId),
      usedMedicationIds: profile.activeMedications.map((medication) => medication.medicationId),
      usedCareTaskIds: profile.careTasks.map((task) => task.carePlanId),
      usedVisitIds: profile.upcomingVisits.map((visit) => visit.encounterId)
    };
  }

  switch (intent) {
    case "diet":
      return buildDietMessage(profile, contextSnapshotRef);
    case "activity":
      return buildActivityMessage(profile, contextSnapshotRef);
    case "habit":
    case "lifestyle":
      return buildHabitMessage(profile, contextSnapshotRef);
    default:
      return {
        isLifestyleIntent: false,
        isOutOfScope: false,
        intent: null,
        assistantMessage: null,
        contextSourceRefs: [],
        usedConditionIds: [],
        usedMedicationIds: [],
        usedCareTaskIds: [],
        usedVisitIds: []
      };
  }
}
