import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

type CompleteCohortProfile = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

type StableIdRegistryEntry = {
  stableId: string;
  identityKey: string;
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
  active: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  lastRefreshRunId: string;
};

export type StableIdMappedProfile = {
  stableId: string;
  identityKey: string;
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

export type StableIdChangeDetection = {
  added: StableIdMappedProfile[];
  removed: StableIdMappedProfile[];
  updated: StableIdMappedProfile[];
  unchanged: StableIdMappedProfile[];
};

export type StableIdLookupIndex = {
  byStableId: Record<string, StableIdMappedProfile>;
  byPatientId: Record<string, string>;
};

export type StableIdRefreshSummary = {
  runId: string;
  completenessRunId: string;
  outputDirectory: string;
  registryPath: string;
  registryBackupPath: string | null;
  mappingReportPath: string;
  lookupIndexPath: string;
  runbookPath: string;
  totalProfiles: number;
  addedCount: number;
  removedCount: number;
  updatedCount: number;
  unchangedCount: number;
  completedAt: string;
};

export type StableIdRefreshOptions = {
  completenessRunId: string;
  runId?: string;
  completenessRootPath?: string;
  outputRootPath?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  return `refresh_${stamp}`;
}

function identityKey(profile: CompleteCohortProfile): string {
  return profile.patientId;
}

function stableIdFromIdentityKey(value: string): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 12);
  return `sp-${digest}`;
}

function toMappedProfile(entry: StableIdRegistryEntry): StableIdMappedProfile {
  return {
    stableId: entry.stableId,
    identityKey: entry.identityKey,
    profileId: entry.profileId,
    patientId: entry.patientId,
    sourceRunId: entry.sourceRunId,
    profileVersion: entry.profileVersion,
    sourceFile: entry.sourceFile
  };
}

function isUpdated(existing: StableIdRegistryEntry, next: CompleteCohortProfile): boolean {
  return (
    existing.profileVersion !== next.profileVersion ||
    existing.sourceRunId !== next.sourceRunId ||
    existing.sourceFile !== next.sourceFile ||
    existing.profileId !== next.profileId
  );
}

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  const content = await readFile(filePath, "utf8").catch(() => "");
  if (!content.trim()) {
    return fallback;
  }

  return JSON.parse(content) as T;
}

function buildRunbookContent(summary: StableIdRefreshSummary): string {
  const lines = [
    "# Stable ID Refresh Runbook",
    "",
    `- Run ID: ${summary.runId}`,
    `- Completeness Run ID: ${summary.completenessRunId}`,
    `- Registry Path: ${summary.registryPath}`,
    `- Registry Backup Path: ${summary.registryBackupPath ?? "none"}`,
    "",
    "## Rollback Guidance",
    "1. Stop downstream publication if change detection is unexpected.",
    "2. Restore registry from backup file (if present).",
    "3. Re-run refresh with corrected input cohort.",
    "",
    "### PowerShell Restore Example",
    summary.registryBackupPath
      ? `Copy-Item \"${summary.registryBackupPath}\" \"${summary.registryPath}\" -Force`
      : "No backup file exists yet for this run.",
    "",
    "## Safety Checks",
    "- Verify mapping report added/removed/updated sections before promoting.",
    "- Verify demo script lookup index resolves all expected stable IDs.",
    "- Keep backup registry snapshot until validation sign-off is complete."
  ];

  return `${lines.join("\n")}\n`;
}

export async function runShowcaseStableIdRefresh(
  options: StableIdRefreshOptions
): Promise<StableIdRefreshSummary> {
  const runId = options.runId ?? defaultRunId();
  const completenessRootPath =
    options.completenessRootPath ??
    path.join(".propel", "context", "data", "curated", "showcase-cohort-completeness");
  const outputRootPath =
    options.outputRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-stable-ids");

  const completenessDirectory = path.join(completenessRootPath, options.completenessRunId);
  const outputDirectory = path.join(outputRootPath, runId);
  const registryPath = path.join(outputRootPath, "stable-id-registry.json");
  const mappingReportPath = path.join(outputDirectory, "stable-id-mapping-report.json");
  const lookupIndexPath = path.join(outputDirectory, "stable-id-lookup.json");
  const runbookPath = path.join(outputDirectory, "stable-id-refresh-runbook.md");

  await mkdir(outputDirectory, { recursive: true });

  const completeProfilesPath = path.join(completenessDirectory, "complete-cohort-profiles.json");
  const completeProfiles = await readJsonOrDefault<CompleteCohortProfile[]>(completeProfilesPath, []);

  const existingRegistry = await readJsonOrDefault<StableIdRegistryEntry[]>(registryPath, []);
  const existingByIdentity = new Map(existingRegistry.map((entry) => [entry.identityKey, entry]));

  const registryBackupPath =
    existingRegistry.length > 0
      ? path.join(outputDirectory, `stable-id-registry.backup.${Date.now()}.json`)
      : null;

  if (registryBackupPath) {
    await cp(registryPath, registryBackupPath, { force: true });
  }

  const added: StableIdMappedProfile[] = [];
  const removed: StableIdMappedProfile[] = [];
  const updated: StableIdMappedProfile[] = [];
  const unchanged: StableIdMappedProfile[] = [];

  const nextRegistryByIdentity = new Map<string, StableIdRegistryEntry>();

  for (const profile of completeProfiles) {
    const key = identityKey(profile);
    const existing = existingByIdentity.get(key);
    const timestamp = nowIso();

    if (!existing) {
      const created: StableIdRegistryEntry = {
        stableId: stableIdFromIdentityKey(key),
        identityKey: key,
        profileId: profile.profileId,
        patientId: profile.patientId,
        sourceRunId: profile.sourceRunId,
        profileVersion: profile.profileVersion,
        sourceFile: profile.sourceFile,
        active: true,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        lastRefreshRunId: runId
      };

      nextRegistryByIdentity.set(key, created);
      added.push(toMappedProfile(created));
      continue;
    }

    const merged: StableIdRegistryEntry = {
      ...existing,
      profileId: profile.profileId,
      patientId: profile.patientId,
      sourceRunId: profile.sourceRunId,
      profileVersion: profile.profileVersion,
      sourceFile: profile.sourceFile,
      active: true,
      lastSeenAt: timestamp,
      lastRefreshRunId: runId
    };

    nextRegistryByIdentity.set(key, merged);

    if (isUpdated(existing, profile)) {
      updated.push(toMappedProfile(merged));
    } else {
      unchanged.push(toMappedProfile(merged));
    }
  }

  for (const existing of existingRegistry) {
    if (nextRegistryByIdentity.has(existing.identityKey)) {
      continue;
    }

    const deactivated: StableIdRegistryEntry = {
      ...existing,
      active: false,
      lastRefreshRunId: runId
    };

    nextRegistryByIdentity.set(existing.identityKey, deactivated);
    removed.push(toMappedProfile(deactivated));
  }

  const nextRegistry = Array.from(nextRegistryByIdentity.values()).sort((a, b) =>
    a.stableId.localeCompare(b.stableId)
  );

  const lookupIndex: StableIdLookupIndex = {
    byStableId: {},
    byPatientId: {}
  };

  for (const entry of nextRegistry) {
    if (!entry.active) {
      continue;
    }

    const mapped = toMappedProfile(entry);
    lookupIndex.byStableId[entry.stableId] = mapped;
    lookupIndex.byPatientId[entry.patientId] = entry.stableId;
  }

  await writeFile(registryPath, JSON.stringify(nextRegistry, null, 2), "utf8");

  const mappingReport = {
    runId,
    completenessRunId: options.completenessRunId,
    deterministicKey: "patientId",
    generatedAt: nowIso(),
    added,
    removed,
    updated,
    unchanged
  };

  await writeFile(mappingReportPath, JSON.stringify(mappingReport, null, 2), "utf8");
  await writeFile(lookupIndexPath, JSON.stringify(lookupIndex, null, 2), "utf8");

  const summary: StableIdRefreshSummary = {
    runId,
    completenessRunId: options.completenessRunId,
    outputDirectory,
    registryPath,
    registryBackupPath,
    mappingReportPath,
    lookupIndexPath,
    runbookPath,
    totalProfiles: completeProfiles.length,
    addedCount: added.length,
    removedCount: removed.length,
    updatedCount: updated.length,
    unchangedCount: unchanged.length,
    completedAt: nowIso()
  };

  const runbookContent = buildRunbookContent(summary);
  await writeFile(runbookPath, runbookContent, "utf8");
  await writeFile(path.join(outputDirectory, "stable-id-refresh-summary.json"), JSON.stringify(summary, null, 2), "utf8");

  return summary;
}

export async function resolveProfileByStableId(
  stableId: string,
  outputRootPath = path.join(".propel", "context", "data", "curated", "showcase-stable-ids")
): Promise<StableIdMappedProfile | null> {
  const registryPath = path.join(outputRootPath, "stable-id-registry.json");
  const registry = await readJsonOrDefault<StableIdRegistryEntry[]>(registryPath, []);
  const matched = registry.find((entry) => entry.stableId === stableId && entry.active);
  return matched ? toMappedProfile(matched) : null;
}
