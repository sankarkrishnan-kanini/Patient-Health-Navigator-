import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CohortProfile = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

type RequiredFieldPath =
  | "patientId"
  | "profileVersion"
  | "sourceRunId"
  | "activeConditions"
  | "activeMedications"
  | "careTasks"
  | "upcomingAppointments"
  | "observations"
  | "sdohFlags";

type MissingFieldDiagnostic = {
  field: RequiredFieldPath;
  reason: string;
};

export type CompletenessRequiredChecklist = {
  version: string;
  fields: RequiredFieldPath[];
};

export type ProfileCompletenessFailure = {
  runId: string;
  profileId: string;
  patientId: string;
  sourceFile: string;
  missingFields: MissingFieldDiagnostic[];
  recordedAt: string;
};

export type ProfileCompletenessPass = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

export type ShowcaseProfileCompletenessSummary = {
  runId: string;
  cohortRunId: string;
  cohortOutputDirectory: string;
  outputDirectory: string;
  checklist: CompletenessRequiredChecklist;
  scannedProfiles: number;
  passedProfiles: number;
  rejectedProfiles: number;
  passRate: number;
  completeProfilesPath: string;
  failuresPath: string;
  reportPath: string;
  completedAt: string;
};

export type ShowcaseProfileCompletenessOptions = {
  cohortRunId: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  checklistVersion?: string;
};

const REQUIRED_FIELDS: RequiredFieldPath[] = [
  "patientId",
  "profileVersion",
  "sourceRunId",
  "activeConditions",
  "activeMedications",
  "careTasks",
  "upcomingAppointments",
  "observations",
  "sdohFlags"
];

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  return `completeness_${stamp}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMissingText(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function validateContext(
  profile: CohortProfile,
  context: unknown,
  runId: string
): ProfileCompletenessFailure | null {
  const missingFields: MissingFieldDiagnostic[] = [];

  if (!isObject(context)) {
    return {
      runId,
      profileId: profile.profileId,
      patientId: profile.patientId,
      sourceFile: profile.sourceFile,
      missingFields: REQUIRED_FIELDS.map((field) => ({
        field,
        reason: "Profile payload is not a valid JSON object."
      })),
      recordedAt: nowIso()
    };
  }

  for (const field of REQUIRED_FIELDS) {
    const value = context[field];

    if (field === "patientId" || field === "profileVersion" || field === "sourceRunId") {
      if (isMissingText(value)) {
        missingFields.push({
          field,
          reason: "Required text field is missing or empty."
        });
      }

      continue;
    }

    if (!Array.isArray(value)) {
      missingFields.push({
        field,
        reason: "Required array field is missing or not an array."
      });
    }
  }

  if (missingFields.length === 0) {
    return null;
  }

  return {
    runId,
    profileId: profile.profileId,
    patientId: profile.patientId,
    sourceFile: profile.sourceFile,
    missingFields,
    recordedAt: nowIso()
  };
}

export async function runShowcaseProfileCompletenessGate(
  options: ShowcaseProfileCompletenessOptions
): Promise<ShowcaseProfileCompletenessSummary> {
  const runId = options.runId ?? defaultRunId();
  const curatedRootPath =
    options.curatedRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-cohort");
  const outputRootPath =
    options.outputRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-cohort-completeness");
  const checklist: CompletenessRequiredChecklist = {
    version: options.checklistVersion ?? "v1.0",
    fields: REQUIRED_FIELDS
  };

  const cohortOutputDirectory = path.join(curatedRootPath, options.cohortRunId);
  const outputDirectory = path.join(outputRootPath, runId);
  const completeProfilesPath = path.join(outputDirectory, "complete-cohort-profiles.json");
  const failuresPath = path.join(outputDirectory, "completeness-failures.json");
  const reportPath = path.join(outputDirectory, "completeness-report.json");

  await mkdir(outputDirectory, { recursive: true });

  const cohortProfilesPath = path.join(cohortOutputDirectory, "cohort-profiles.json");
  const profiles = JSON.parse(await readFile(cohortProfilesPath, "utf8")) as CohortProfile[];

  const completeProfiles: ProfileCompletenessPass[] = [];
  const failures: ProfileCompletenessFailure[] = [];

  for (const profile of profiles) {
    let parsedContext: unknown;

    try {
      parsedContext = JSON.parse(await readFile(profile.sourceFile, "utf8"));
    } catch {
      failures.push({
        runId,
        profileId: profile.profileId,
        patientId: profile.patientId,
        sourceFile: profile.sourceFile,
        missingFields: [{ field: "patientId", reason: "Profile file cannot be parsed as valid JSON." }],
        recordedAt: nowIso()
      });
      continue;
    }

    const failure = validateContext(profile, parsedContext, runId);
    if (failure) {
      failures.push(failure);
      continue;
    }

    completeProfiles.push({
      profileId: profile.profileId,
      patientId: profile.patientId,
      sourceRunId: profile.sourceRunId,
      profileVersion: profile.profileVersion,
      sourceFile: profile.sourceFile
    });
  }

  await writeFile(completeProfilesPath, JSON.stringify(completeProfiles, null, 2), "utf8");
  await writeFile(failuresPath, JSON.stringify(failures, null, 2), "utf8");

  const scannedProfiles = profiles.length;
  const passedProfiles = completeProfiles.length;
  const rejectedProfiles = failures.length;
  const passRate = scannedProfiles === 0 ? 0 : passedProfiles / scannedProfiles;

  const summary: ShowcaseProfileCompletenessSummary = {
    runId,
    cohortRunId: options.cohortRunId,
    cohortOutputDirectory,
    outputDirectory,
    checklist,
    scannedProfiles,
    passedProfiles,
    rejectedProfiles,
    passRate,
    completeProfilesPath,
    failuresPath,
    reportPath,
    completedAt: nowIso()
  };

  await writeFile(reportPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
