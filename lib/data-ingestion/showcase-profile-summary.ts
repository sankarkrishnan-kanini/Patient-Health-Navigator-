import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const PROFILE_SUMMARY_SCHEMA_VERSION = "v1.0";

type CompletenessPassProfile = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

type ActiveCondition = {
  conditionId: string;
  codeText: string;
};

type ActiveMedication = {
  medicationId: string;
  name: string;
};

type CareTask = {
  carePlanId: string;
  description: string;
  status: string;
};

type UpcomingAppointment = {
  encounterId: string;
  status: string;
  start: string | null;
};

type RelevantObservation = {
  observationId: string;
  codeText: string;
  valueText: string;
  issued: string | null;
};

type SdohFlag = {
  observationId: string;
  flag: string;
  value: string;
};

type NormalizedPatientContext = {
  patientId: string;
  profileVersion: string;
  sourceRunId: string;
  generatedAt: string;
  activeConditions: ActiveCondition[];
  activeMedications: ActiveMedication[];
  careTasks: CareTask[];
  upcomingAppointments: UpcomingAppointment[];
  observations: RelevantObservation[];
  sdohFlags: SdohFlag[];
};

export type ProfileSummaryPayload = {
  schemaVersion: string;
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  generatedAt: string;
  counts: {
    activeConditions: number;
    activeMedications: number;
    careTasks: number;
    upcomingAppointments: number;
    observations: number;
    sdohFlags: number;
  };
  highlights: {
    topConditions: string[];
    topMedications: string[];
    nextAppointment: {
      encounterId: string;
      start: string | null;
      status: string;
    } | null;
    keyObservations: Array<{
      observationId: string;
      label: string;
      value: string;
    }>;
    sdohFlags: Array<{
      observationId: string;
      flag: string;
      value: string;
    }>;
  };
};

export type ProfileSummaryValidationIssue = {
  profileId: string;
  field: string;
  message: string;
};

export type ProfileSummaryValidationFailure = {
  profileId: string;
  patientId: string;
  sourceFile: string;
  issues: ProfileSummaryValidationIssue[];
};

export type ProfileSummaryExportSummary = {
  runId: string;
  completenessRunId: string;
  outputDirectory: string;
  schemaVersion: string;
  selectedProfiles: number;
  generatedSummaries: number;
  validationFailures: number;
  summariesPath: string;
  failuresPath: string;
  schemaPath: string;
  reportPath: string;
  completedAt: string;
};

export type ProfileSummaryExportOptions = {
  completenessRunId: string;
  runId?: string;
  schemaVersion?: string;
  completenessRootPath?: string;
  outputRootPath?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  return `summary_${stamp}`;
}

function isMissingText(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function sortByIssued(observations: RelevantObservation[]): RelevantObservation[] {
  return [...observations].sort((a, b) => (b.issued ?? "").localeCompare(a.issued ?? ""));
}

export function createProfileSummaryPayload(
  profile: CompletenessPassProfile,
  context: NormalizedPatientContext,
  schemaVersion = PROFILE_SUMMARY_SCHEMA_VERSION
): ProfileSummaryPayload {
  const sortedAppointments = [...context.upcomingAppointments].sort((a, b) =>
    (a.start ?? "").localeCompare(b.start ?? "")
  );
  const nextAppointment = sortedAppointments[0] ?? null;

  return {
    schemaVersion,
    profileId: profile.profileId,
    patientId: context.patientId,
    sourceRunId: context.sourceRunId,
    profileVersion: context.profileVersion,
    generatedAt: context.generatedAt,
    counts: {
      activeConditions: context.activeConditions.length,
      activeMedications: context.activeMedications.length,
      careTasks: context.careTasks.length,
      upcomingAppointments: context.upcomingAppointments.length,
      observations: context.observations.length,
      sdohFlags: context.sdohFlags.length
    },
    highlights: {
      topConditions: context.activeConditions.slice(0, 3).map((condition) => condition.codeText),
      topMedications: context.activeMedications.slice(0, 3).map((medication) => medication.name),
      nextAppointment: nextAppointment
        ? {
            encounterId: nextAppointment.encounterId,
            start: nextAppointment.start,
            status: nextAppointment.status
          }
        : null,
      keyObservations: sortByIssued(context.observations)
        .slice(0, 3)
        .map((observation) => ({
          observationId: observation.observationId,
          label: observation.codeText,
          value: observation.valueText
        })),
      sdohFlags: context.sdohFlags.slice(0, 3).map((flag) => ({
        observationId: flag.observationId,
        flag: flag.flag,
        value: flag.value
      }))
    }
  };
}

export function validateProfileSummaryPayload(payload: ProfileSummaryPayload): ProfileSummaryValidationIssue[] {
  const issues: ProfileSummaryValidationIssue[] = [];
  const profileId = payload.profileId;

  if (isMissingText(payload.schemaVersion)) {
    issues.push({ profileId, field: "schemaVersion", message: "Schema version is required." });
  }

  if (isMissingText(payload.profileId)) {
    issues.push({ profileId, field: "profileId", message: "Profile identifier is required." });
  }

  if (isMissingText(payload.patientId)) {
    issues.push({ profileId, field: "patientId", message: "Patient identifier is required." });
  }

  if (isMissingText(payload.sourceRunId)) {
    issues.push({ profileId, field: "sourceRunId", message: "Source run identifier is required." });
  }

  if (isMissingText(payload.profileVersion)) {
    issues.push({ profileId, field: "profileVersion", message: "Profile version is required." });
  }

  if (!Array.isArray(payload.highlights.topConditions)) {
    issues.push({
      profileId,
      field: "highlights.topConditions",
      message: "Top conditions must be an array."
    });
  }

  if (!Array.isArray(payload.highlights.topMedications)) {
    issues.push({
      profileId,
      field: "highlights.topMedications",
      message: "Top medications must be an array."
    });
  }

  if (!Array.isArray(payload.highlights.keyObservations)) {
    issues.push({
      profileId,
      field: "highlights.keyObservations",
      message: "Key observations must be an array."
    });
  }

  if (!Array.isArray(payload.highlights.sdohFlags)) {
    issues.push({
      profileId,
      field: "highlights.sdohFlags",
      message: "SDOH flags must be an array."
    });
  }

  return issues;
}

export async function exportShowcaseProfileSummaries(
  options: ProfileSummaryExportOptions
): Promise<ProfileSummaryExportSummary> {
  const runId = options.runId ?? defaultRunId();
  const completenessRootPath =
    options.completenessRootPath ??
    path.join(".propel", "context", "data", "curated", "showcase-cohort-completeness");
  const outputRootPath =
    options.outputRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-profile-summaries");
  const schemaVersion = options.schemaVersion ?? PROFILE_SUMMARY_SCHEMA_VERSION;

  const completenessDirectory = path.join(completenessRootPath, options.completenessRunId);
  const outputDirectory = path.join(outputRootPath, runId);
  const summariesPath = path.join(outputDirectory, "profile-summaries.json");
  const failuresPath = path.join(outputDirectory, "summary-validation-failures.json");
  const schemaPath = path.join(outputDirectory, "profile-summary-schema.json");
  const reportPath = path.join(outputDirectory, "summary-export-report.json");

  await mkdir(outputDirectory, { recursive: true });

  const selectedProfilesPath = path.join(completenessDirectory, "complete-cohort-profiles.json");
  const selectedProfiles = JSON.parse(await readFile(selectedProfilesPath, "utf8")) as CompletenessPassProfile[];

  const summaries: ProfileSummaryPayload[] = [];
  const failures: ProfileSummaryValidationFailure[] = [];

  for (const profile of selectedProfiles) {
    const context = JSON.parse(await readFile(profile.sourceFile, "utf8")) as NormalizedPatientContext;
    const summaryPayload = createProfileSummaryPayload(profile, context, schemaVersion);
    const issues = validateProfileSummaryPayload(summaryPayload);

    if (issues.length > 0) {
      failures.push({
        profileId: profile.profileId,
        patientId: profile.patientId,
        sourceFile: profile.sourceFile,
        issues
      });
      continue;
    }

    summaries.push(summaryPayload);
  }

  const schemaDocument = {
    version: schemaVersion,
    requiredFields: [
      "schemaVersion",
      "profileId",
      "patientId",
      "sourceRunId",
      "profileVersion",
      "generatedAt",
      "counts",
      "highlights"
    ],
    highlights: {
      requiredFields: [
        "topConditions",
        "topMedications",
        "nextAppointment",
        "keyObservations",
        "sdohFlags"
      ]
    }
  };

  await writeFile(summariesPath, JSON.stringify(summaries, null, 2), "utf8");
  await writeFile(failuresPath, JSON.stringify(failures, null, 2), "utf8");
  await writeFile(schemaPath, JSON.stringify(schemaDocument, null, 2), "utf8");

  const report: ProfileSummaryExportSummary = {
    runId,
    completenessRunId: options.completenessRunId,
    outputDirectory,
    schemaVersion,
    selectedProfiles: selectedProfiles.length,
    generatedSummaries: summaries.length,
    validationFailures: failures.length,
    summariesPath,
    failuresPath,
    schemaPath,
    reportPath,
    completedAt: nowIso()
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  return report;
}
