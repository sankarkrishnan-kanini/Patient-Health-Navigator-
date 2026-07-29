import { cp, mkdtemp, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  REQUIRED_FHIR_RESOURCE_TYPES,
  ingestFhirBatch
} from "@/lib/data-ingestion/fhir-ingestion";

describe("FHIR ingestion pipeline", () => {
  it("ingests required resources and quarantines invalid files", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "fhir-ingestion-"));
    const inputRoot = path.join(workspace, "input");
    const stagingRootPath = path.join(workspace, "staging");
    const quarantineRootPath = path.join(workspace, "quarantine");

    await mkdir(inputRoot, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "bundle-all.json"),
      path.join(inputRoot, "bundle-all.json")
    );
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "unsupported-resource.json"),
      path.join(inputRoot, "unsupported-resource.json")
    );
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "malformed.json"),
      path.join(inputRoot, "malformed.json")
    );

    const summary = await ingestFhirBatch({
      inputPath: inputRoot,
      runId: "run_test_001",
      stagingRootPath,
      quarantineRootPath
    });

    for (const type of REQUIRED_FHIR_RESOURCE_TYPES) {
      expect(summary.resourceCounts[type].success).toBe(1);
    }

    expect(summary.scannedFiles).toBe(3);
    expect(summary.stagedResources).toBe(6);
    expect(summary.failedFiles).toBe(2);

    const summaryPath = path.join(stagingRootPath, "run_test_001", "run-summary.json");
    const savedSummary = JSON.parse(await readFile(summaryPath, "utf8")) as { runId: string };
    expect(savedSummary.runId).toBe("run_test_001");

    const patientRecordsPath = path.join(stagingRootPath, "run_test_001", "Patient.ndjson");
    const patientRecords = (await readFile(patientRecordsPath, "utf8")).trim().split("\n");
    const firstPatient = JSON.parse(patientRecords[0]) as {
      runId: string;
      sourceFile: string;
      resourceType: string;
    };

    expect(firstPatient.runId).toBe("run_test_001");
    expect(firstPatient.resourceType).toBe("Patient");
    expect(firstPatient.sourceFile.toLowerCase().endsWith("bundle-all.json")).toBe(true);

    const quarantineFiles = await readdir(path.join(quarantineRootPath, "run_test_001"));
    expect(quarantineFiles).toContain("unsupported-resource.json");
    expect(quarantineFiles).toContain("malformed.json");
    expect(quarantineFiles).toContain("failures.ndjson");
  });

  it("suppresses duplicate resources at ingest boundary and logs events", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "fhir-ingestion-dup-"));
    const inputRoot = path.join(workspace, "input");
    const stagingRootPath = path.join(workspace, "staging");
    const quarantineRootPath = path.join(workspace, "quarantine");

    await mkdir(inputRoot, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "bundle-duplicates.json"),
      path.join(inputRoot, "bundle-duplicates.json")
    );

    const summary = await ingestFhirBatch({
      inputPath: inputRoot,
      runId: "run_test_dup_001",
      stagingRootPath,
      quarantineRootPath
    });

    expect(summary.resourceCounts.Patient.success).toBe(1);
    expect(summary.resourceCounts.Condition.success).toBe(1);
    expect(summary.resourceCounts.MedicationRequest.success).toBe(1);
    expect(summary.duplicateEventCount).toBe(2);
    expect(summary.duplicateEvents).toHaveLength(2);
  });
});
