import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type NormalizedPatientContext = {
  patientId: string;
  profileVersion: string;
  sourceRunId: string;
  [key: string]: unknown;
};

type CohortFailureRecord = {
  runId: string;
  sourceFile: string;
  reason: string;
  recordedAt: string;
};

export type ShowcaseCohortProfile = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

export type ShowcaseCohortSummary = {
  runId: string;
  sourceRunId: string;
  sourceDirectory: string;
  outputDirectory: string;
  minProfiles: number;
  maxProfiles: number;
  scannedFiles: number;
  selectedPatientCount: number;
  selectedProfiles: ShowcaseCohortProfile[];
  failedRecords: CohortFailureRecord[];
  selectedProfilesPath: string;
  selectedProfileIdsPath: string;
  failuresPath: string;
  completedAt: string;
};

export type ShowcaseCohortSelectionOptions = {
  sourceRunId: string;
  runId?: string;
  normalizedRootPath?: string;
  outputRootPath?: string;
  minProfiles?: number;
  maxProfiles?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  return `cohort_${stamp}`;
}

async function appendNdjsonLine(filePath: string, record: unknown): Promise<void> {
  const existing = await readFile(filePath, "utf8").catch(() => "");
  await writeFile(filePath, `${existing}${JSON.stringify(record)}\n`, "utf8");
}

function toProfile(context: NormalizedPatientContext, sourceFile: string): ShowcaseCohortProfile {
  return {
    profileId: context.patientId,
    patientId: context.patientId,
    sourceRunId: context.sourceRunId,
    profileVersion: context.profileVersion,
    sourceFile
  };
}

export async function buildShowcaseCohort(
  options: ShowcaseCohortSelectionOptions
): Promise<ShowcaseCohortSummary> {
  const minProfiles = options.minProfiles ?? 5;
  const maxProfiles = options.maxProfiles ?? 10;

  if (minProfiles < 1 || maxProfiles < minProfiles) {
    throw new Error("Invalid cohort size bounds. Ensure 1 <= minProfiles <= maxProfiles.");
  }

  const runId = options.runId ?? defaultRunId();
  const normalizedRootPath =
    options.normalizedRootPath ?? path.join(".propel", "context", "data", "normalized", "patient-context");
  const outputRootPath =
    options.outputRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-cohort");

  const sourceDirectory = path.join(normalizedRootPath, options.sourceRunId, "patients");
  const outputDirectory = path.join(outputRootPath, runId);
  const selectedProfilesPath = path.join(outputDirectory, "cohort-profiles.json");
  const selectedProfileIdsPath = path.join(outputDirectory, "cohort-profile-ids.txt");
  const failuresPath = path.join(outputDirectory, "cohort-failures.ndjson");

  await mkdir(outputDirectory, { recursive: true });

  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
    .map((entry) => path.join(sourceDirectory, entry.name));

  const failures: CohortFailureRecord[] = [];
  const profilesById = new Map<string, ShowcaseCohortProfile>();

  for (const file of files) {
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as NormalizedPatientContext;
      if (!parsed.patientId || !parsed.patientId.trim()) {
        throw new Error("Missing required patientId field.");
      }

      const profile = toProfile(parsed, file);
      profilesById.set(profile.profileId, profile);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown cohort parsing error.";
      const failure: CohortFailureRecord = {
        runId,
        sourceFile: file,
        reason,
        recordedAt: nowIso()
      };

      failures.push(failure);
      await appendNdjsonLine(failuresPath, failure);
    }
  }

  const selectedProfiles = Array.from(profilesById.values())
    .sort((a, b) => a.patientId.localeCompare(b.patientId))
    .slice(0, maxProfiles);

  if (selectedProfiles.length < minProfiles) {
    throw new Error(
      `Cohort selection produced ${selectedProfiles.length} eligible profiles; minimum required is ${minProfiles}.`
    );
  }

  const selectedIds = selectedProfiles.map((profile) => profile.profileId);

  await writeFile(selectedProfilesPath, JSON.stringify(selectedProfiles, null, 2), "utf8");
  await writeFile(selectedProfileIdsPath, `${selectedIds.join("\n")}\n`, "utf8");

  const summary: ShowcaseCohortSummary = {
    runId,
    sourceRunId: options.sourceRunId,
    sourceDirectory,
    outputDirectory,
    minProfiles,
    maxProfiles,
    scannedFiles: files.length,
    selectedPatientCount: selectedProfiles.length,
    selectedProfiles,
    failedRecords: failures,
    selectedProfilesPath,
    selectedProfileIdsPath,
    failuresPath,
    completedAt: nowIso()
  };

  await writeFile(path.join(outputDirectory, "cohort-summary.json"), JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
