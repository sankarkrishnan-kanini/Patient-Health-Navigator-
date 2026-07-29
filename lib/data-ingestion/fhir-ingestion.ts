import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_FHIR_RESOURCE_TYPES = [
  "Patient",
  "Condition",
  "MedicationRequest",
  "CarePlan",
  "Encounter",
  "Observation"
] as const;

type RequiredFhirResourceType = (typeof REQUIRED_FHIR_RESOURCE_TYPES)[number];

type FhirResource = {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
};

type ParsedSource = {
  sourceFile: string;
  resources: FhirResource[];
};

type StagedResourceRecord = {
  runId: string;
  sourceFile: string;
  resourceType: RequiredFhirResourceType;
  resourceId: string;
  ingestedAt: string;
  payload: FhirResource;
};

type IngestionFailureRecord = {
  runId: string;
  sourceFile: string;
  reason: string;
};

type IngestionDuplicateEvent = {
  runId: string;
  resourceType: RequiredFhirResourceType;
  resourceId: string;
  sourceFile: string;
  reason: string;
  detectedAt: string;
};

type ResourceCount = {
  success: number;
  failure: number;
};

export type FhirIngestionSummary = {
  runId: string;
  inputPath: string;
  stagedDirectory: string;
  quarantineDirectory: string;
  scannedFiles: number;
  stagedResources: number;
  failedFiles: number;
  resourceCounts: Record<RequiredFhirResourceType, ResourceCount>;
  failures: IngestionFailureRecord[];
  duplicateEvents: IngestionDuplicateEvent[];
  duplicateEventCount: number;
  duplicateEventsPath: string;
  completedAt: string;
};

export type FhirIngestionOptions = {
  inputPath: string;
  runId?: string;
  stagingRootPath?: string;
  quarantineRootPath?: string;
};

const resourceTypeSet = new Set(REQUIRED_FHIR_RESOURCE_TYPES);

function defaultRunId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${stamp}_${random}`;
}

function emptyResourceCounts(): Record<RequiredFhirResourceType, ResourceCount> {
  return REQUIRED_FHIR_RESOURCE_TYPES.reduce(
    (accumulator, type) => {
      accumulator[type] = { success: 0, failure: 0 };
      return accumulator;
    },
    {} as Record<RequiredFhirResourceType, ResourceCount>
  );
}

async function listJsonFiles(inputPath: string): Promise<string[]> {
  const targetStats = await stat(inputPath);
  if (targetStats.isFile()) {
    return inputPath.toLowerCase().endsWith(".json") ? [inputPath] : [];
  }

  const entries = await readdir(inputPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => listJsonFiles(path.join(inputPath, entry.name)))
  );

  return nested.flat();
}

function inferResourceId(resource: FhirResource): string {
  return resource.id ?? "unknown-id";
}

function bundleResources(payload: unknown): FhirResource[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const bundle = payload as { resourceType?: unknown; entry?: unknown };
  if (bundle.resourceType !== "Bundle") {
    return null;
  }

  if (!Array.isArray(bundle.entry)) {
    return [];
  }

  return bundle.entry
    .map((entry) => {
      const candidate = (entry as { resource?: unknown }).resource;
      if (!candidate || typeof candidate !== "object") {
        return null;
      }

      const resource = candidate as FhirResource;
      return typeof resource.resourceType === "string" ? resource : null;
    })
    .filter((resource): resource is FhirResource => resource !== null);
}

function singleResource(payload: unknown): FhirResource[] | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as FhirResource;
  if (typeof candidate.resourceType !== "string") {
    return null;
  }

  if (candidate.resourceType === "Bundle") {
    return null;
  }

  return [candidate];
}

function extractResources(payload: unknown): FhirResource[] {
  const fromBundle = bundleResources(payload);
  if (fromBundle !== null) {
    return fromBundle;
  }

  const fromSingle = singleResource(payload);
  if (fromSingle !== null) {
    return fromSingle;
  }

  throw new Error("JSON document is not a supported FHIR resource or Bundle payload.");
}

async function parseSourceFile(sourceFile: string): Promise<ParsedSource> {
  const rawContent = await readFile(sourceFile, "utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("Invalid JSON content.");
  }

  const resources = extractResources(parsed);
  if (resources.length === 0) {
    throw new Error("FHIR Bundle contains no ingestible resources.");
  }

  return {
    sourceFile,
    resources
  };
}

async function appendNdjsonLine(filePath: string, record: unknown): Promise<void> {
  const existing = await readFile(filePath, "utf8").catch(() => "");
  const nextContent = `${existing}${JSON.stringify(record)}\n`;
  await writeFile(filePath, nextContent, "utf8");
}

function resourceKey(resourceType: RequiredFhirResourceType, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

async function quarantineFile(
  sourceFile: string,
  quarantineRoot: string,
  reason: string,
  runId: string,
  failures: IngestionFailureRecord[]
): Promise<void> {
  const fileName = path.basename(sourceFile);
  const targetPath = path.join(quarantineRoot, fileName);
  await cp(sourceFile, targetPath, { force: true });

  const failure: IngestionFailureRecord = {
    runId,
    sourceFile,
    reason
  };

  failures.push(failure);
  await appendNdjsonLine(path.join(quarantineRoot, "failures.ndjson"), failure);
}

export async function ingestFhirBatch(options: FhirIngestionOptions): Promise<FhirIngestionSummary> {
  const runId = options.runId ?? defaultRunId();
  const stagingRootPath =
    options.stagingRootPath ?? path.join(".propel", "context", "data", "staging", "raw-fhir");
  const quarantineRootPath =
    options.quarantineRootPath ??
    path.join(".propel", "context", "data", "quarantine", "raw-fhir");

  const stagedDirectory = path.join(stagingRootPath, runId);
  const quarantineDirectory = path.join(quarantineRootPath, runId);

  await mkdir(stagedDirectory, { recursive: true });
  await mkdir(quarantineDirectory, { recursive: true });

  const resourceCounts = emptyResourceCounts();
  const failures: IngestionFailureRecord[] = [];
  const duplicateEvents: IngestionDuplicateEvent[] = [];
  const seenResourceKeys = new Set<string>();

  const files = await listJsonFiles(options.inputPath);

  for (const file of files) {
    try {
      const parsedSource = await parseSourceFile(file);

      for (const resource of parsedSource.resources) {
        if (!resourceTypeSet.has(resource.resourceType as RequiredFhirResourceType)) {
          await quarantineFile(
            file,
            quarantineDirectory,
            `Unsupported resource type: ${resource.resourceType}`,
            runId,
            failures
          );

          const knownType = resource.resourceType as RequiredFhirResourceType;
          if (resourceTypeSet.has(knownType)) {
            resourceCounts[knownType].failure += 1;
          }

          continue;
        }

        const resourceType = resource.resourceType as RequiredFhirResourceType;
        const stagedRecord: StagedResourceRecord = {
          runId,
          sourceFile: parsedSource.sourceFile,
          resourceType,
          resourceId: inferResourceId(resource),
          ingestedAt: new Date().toISOString(),
          payload: resource
        };

        const dedupKey = resourceKey(resourceType, stagedRecord.resourceId);
        if (seenResourceKeys.has(dedupKey)) {
          const duplicateEvent: IngestionDuplicateEvent = {
            runId,
            resourceType,
            resourceId: stagedRecord.resourceId,
            sourceFile: parsedSource.sourceFile,
            reason: "Duplicate resource detected at ingestion boundary.",
            detectedAt: new Date().toISOString()
          };

          duplicateEvents.push(duplicateEvent);
          await appendNdjsonLine(path.join(stagedDirectory, "duplicate-events.ndjson"), duplicateEvent);
          continue;
        }

        seenResourceKeys.add(dedupKey);

        await appendNdjsonLine(path.join(stagedDirectory, `${resourceType}.ndjson`), stagedRecord);
        resourceCounts[resourceType].success += 1;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown ingestion failure.";
      await quarantineFile(file, quarantineDirectory, reason, runId, failures);
    }
  }

  const stagedResources = Object.values(resourceCounts).reduce(
    (total, count) => total + count.success,
    0
  );

  const summary: FhirIngestionSummary = {
    runId,
    inputPath: options.inputPath,
    stagedDirectory,
    quarantineDirectory,
    scannedFiles: files.length,
    stagedResources,
    failedFiles: failures.length,
    resourceCounts,
    failures,
    duplicateEvents,
    duplicateEventCount: duplicateEvents.length,
    duplicateEventsPath: path.join(stagedDirectory, "duplicate-events.ndjson"),
    completedAt: new Date().toISOString()
  };

  await writeFile(path.join(stagedDirectory, "run-summary.json"), JSON.stringify(summary, null, 2), "utf8");

  return summary;
}
