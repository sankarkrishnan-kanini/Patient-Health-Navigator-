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

const SHOWCASE_PROFILE_SUMMARIES: Record<string, PatientProfileSummary> = {
  "patient-400": {
    profileId: "patient-400",
    patientId: "patient-400",
    activeConditions: [{ conditionId: "c1", label: "Condition A" }],
    activeMedications: [],
    careTasks: [],
    upcomingVisits: []
  },
  "patient-401": {
    profileId: "patient-401",
    patientId: "patient-401",
    activeConditions: [],
    activeMedications: [
      {
        medicationId: "m1",
        name: "Medication A",
        schedule: "Every morning",
        purpose: "Blood sugar management"
      }
    ],
    careTasks: [],
    upcomingVisits: []
  },
  "patient-402": {
    profileId: "patient-402",
    patientId: "patient-402",
    activeConditions: [],
    activeMedications: [
      {
        medicationId: "m2",
        name: "Medication B",
        schedule: "Twice daily with meals",
        purpose: null
      }
    ],
    careTasks: [{ carePlanId: "cp1", description: "Annual wellness follow-up", status: "open" }],
    upcomingVisits: []
  },
  "patient-403": {
    profileId: "patient-403",
    patientId: "patient-403",
    activeConditions: [],
    activeMedications: [],
    careTasks: [{ carePlanId: "cp2", description: "Review blood pressure trend", status: "planned" }],
    upcomingVisits: [
      {
        encounterId: "encounter-1",
        start: "2099-01-01T00:00:00Z",
        status: "planned"
      }
    ]
  },
  "patient-404": {
    profileId: "patient-404",
    patientId: "patient-404",
    activeConditions: [{ conditionId: "c2", label: "Condition B" }],
    activeMedications: [
      {
        medicationId: "m3",
        name: "Medication C",
        schedule: null,
        purpose: "Blood pressure support"
      }
    ],
    careTasks: [],
    upcomingVisits: [{ encounterId: "encounter-2", status: "scheduled", start: "2099-02-15T09:30:00Z" }]
  },
  "patient-405": {
    profileId: "patient-405",
    patientId: "patient-405",
    activeConditions: [],
    activeMedications: [],
    careTasks: [],
    upcomingVisits: []
  }
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
  return SHOWCASE_PROFILE_SUMMARIES[profileId] ?? null;
}