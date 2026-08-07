import { fetchDynamicProfileSummary } from "@/lib/showcase/profile-data";

export type ProfileCondition = {
  conditionId: string;
  label: string;
};

export type ProfileMedication = {
  medicationId: string;
  name: string;
  schedule: string | null;
  purpose: string | null;
};

export type ProfileCareTask = {
  carePlanId: string;
  description: string;
  status: string;
};

export type ProfileVisit = {
  encounterId: string;
  status: string;
  start: string | null;
};

export type PatientProfileSummary = {
  profileId: string;
  patientId: string;
  activeConditions: ProfileCondition[];
  activeMedications: ProfileMedication[];
  careTasks: ProfileCareTask[];
  upcomingVisits: ProfileVisit[];
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchShowcaseProfileSummary(
  profileId: string,
  options?: { delayMs?: number }
): Promise<PatientProfileSummary | null> {
  await wait(options?.delayMs ?? 350);
  return fetchDynamicProfileSummary(profileId);
}