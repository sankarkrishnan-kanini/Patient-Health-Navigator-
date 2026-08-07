import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";
import type {
  PatientProfileSummary,
  ProfileCareTask,
  ProfileCondition,
  ProfileMedication,
  ProfileVisit
} from "@/lib/showcase/profile-summary";

type NormalizedCondition = {
  conditionId: string;
  codeText: string;
  clinicalStatus?: string;
};

type NormalizedMedication = {
  medicationId: string;
  name: string;
  scheduleText?: string | null;
  status?: string;
};

type NormalizedCareTask = {
  carePlanId: string;
  description: string;
  status: string;
};

type NormalizedAppointment = {
  encounterId: string;
  status: string;
  start: string | null;
};

type NormalizedPatientContext = {
  patientId: string;
  activeConditions?: NormalizedCondition[];
  activeMedications?: NormalizedMedication[];
  careTasks?: NormalizedCareTask[];
  upcomingAppointments?: NormalizedAppointment[];
};

const NORMALIZED_PATIENT_CONTEXT_ROOT = path.join(
  process.cwd(),
  ".propel",
  "context",
  "data",
  "normalized",
  "patient-context"
);

function toProfileConditions(conditions: NormalizedCondition[] | undefined): ProfileCondition[] {
  return (conditions ?? [])
    .filter((condition) => {
      const status = condition.clinicalStatus?.toLowerCase();
      return !status || status === "active";
    })
    .map((condition) => ({
      conditionId: condition.conditionId,
      label: condition.codeText || "Unknown condition"
    }));
}

function toProfileMedications(medications: NormalizedMedication[] | undefined): ProfileMedication[] {
  return (medications ?? [])
    .filter((medication) => {
      const status = medication.status?.toLowerCase();
      return !status || status === "active";
    })
    .map((medication) => ({
      medicationId: medication.medicationId,
      name: medication.name || "Unknown medication",
      schedule: medication.scheduleText ?? null,
      purpose: null
    }));
}

function toProfileCareTasks(careTasks: NormalizedCareTask[] | undefined): ProfileCareTask[] {
  return (careTasks ?? []).map((task) => ({
    carePlanId: task.carePlanId,
    description: task.description,
    status: task.status
  }));
}

function toProfileVisits(visits: NormalizedAppointment[] | undefined): ProfileVisit[] {
  return (visits ?? []).map((visit) => ({
    encounterId: visit.encounterId,
    status: visit.status,
    start: visit.start ?? null
  }));
}

function toPatientProfileSummary(context: NormalizedPatientContext): PatientProfileSummary {
  return {
    profileId: context.patientId,
    patientId: context.patientId,
    activeConditions: toProfileConditions(context.activeConditions),
    activeMedications: toProfileMedications(context.activeMedications),
    careTasks: toProfileCareTasks(context.careTasks),
    upcomingVisits: toProfileVisits(context.upcomingAppointments)
  };
}

function createPatientLabel(patientId: string): string {
  const suffix = patientId.replace(/^patient[-_]?/i, "");
  return suffix.length > 0 ? `Patient ${suffix}` : patientId;
}

function createPatientSummary(summary: PatientProfileSummary): string {
  const conditionCount = summary.activeConditions.length;
  const medicationCount = summary.activeMedications.length;
  const taskCount = summary.careTasks.length;
  const visitCount = summary.upcomingVisits.length;

  return `${conditionCount} conditions, ${medicationCount} medications, ${taskCount} care tasks, ${visitCount} upcoming visits.`;
}

async function resolveLatestRunPatientsDirectory(): Promise<string | null> {
  const entries = await readdir(NORMALIZED_PATIENT_CONTEXT_ROOT, { withFileTypes: true }).catch(() => []);
  const runDirectories = entries.filter((entry) => entry.isDirectory());

  let latestDirectoryPath: string | null = null;
  let latestTimestamp = -1;

  for (const runDirectory of runDirectories) {
    const runDirectoryPath = path.join(NORMALIZED_PATIENT_CONTEXT_ROOT, runDirectory.name);
    const patientsDirectoryPath = path.join(runDirectoryPath, "patients");
    const directoryStats = await stat(patientsDirectoryPath).catch(() => null);
    if (!directoryStats || !directoryStats.isDirectory()) {
      continue;
    }

    if (directoryStats.mtimeMs > latestTimestamp) {
      latestTimestamp = directoryStats.mtimeMs;
      latestDirectoryPath = patientsDirectoryPath;
    }
  }

  return latestDirectoryPath;
}

async function loadDynamicProfileSummaries(): Promise<PatientProfileSummary[]> {
  const latestPatientsDirectory = await resolveLatestRunPatientsDirectory();
  if (!latestPatientsDirectory) {
    return [];
  }

  const entries = await readdir(latestPatientsDirectory, { withFileTypes: true }).catch(() => []);
  const profileFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(latestPatientsDirectory, entry.name));

  const summaries: PatientProfileSummary[] = [];
  for (const profileFile of profileFiles) {
    const rawContent = await readFile(profileFile, "utf8").catch(() => "");
    if (!rawContent) {
      continue;
    }

    const parsed = JSON.parse(rawContent) as Partial<NormalizedPatientContext>;
    if (!parsed.patientId || typeof parsed.patientId !== "string") {
      continue;
    }

    summaries.push(
      toPatientProfileSummary({
        patientId: parsed.patientId,
        activeConditions: Array.isArray(parsed.activeConditions) ? parsed.activeConditions : [],
        activeMedications: Array.isArray(parsed.activeMedications) ? parsed.activeMedications : [],
        careTasks: Array.isArray(parsed.careTasks) ? parsed.careTasks : [],
        upcomingAppointments: Array.isArray(parsed.upcomingAppointments)
          ? parsed.upcomingAppointments
          : []
      })
    );
  }

  return summaries.sort((left, right) => left.profileId.localeCompare(right.profileId));
}

export async function fetchDynamicProfileSummary(profileId: string): Promise<PatientProfileSummary | null> {
  const summaries = await loadDynamicProfileSummaries();
  return summaries.find((summary) => summary.profileId === profileId) ?? null;
}

export async function listDynamicPatientOptions(): Promise<ShowcasePatientOption[]> {
  const summaries = await loadDynamicProfileSummaries();
  return summaries.map((summary) => ({
    profileId: summary.profileId,
    label: createPatientLabel(summary.profileId),
    summary: createPatientSummary(summary)
  }));
}
