import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ingestFhirBatch } from "@/lib/data-ingestion/fhir-ingestion";
import {
  type NormalizedPatientContext,
  type NormalizationValidationReport,
  normalizeFhirStagedRun,
  queryNormalizationLineage,
  queryNormalizationReprocessingHistory,
  validateLineageCoverageForRun
} from "@/lib/data-ingestion/fhir-normalization";

describe("FHIR normalization pipeline", () => {
  it("normalizes staged records into patient context domains", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "fhir-normalization-"));
    const fixtureRoot = path.join(workspace, "fixtures");
    const stagedRootPath = path.join(workspace, "staging");
    const quarantineRootPath = path.join(workspace, "quarantine");
    const outputRootPath = path.join(workspace, "normalized");

    await mkdir(fixtureRoot, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "bundle-normalization.json"),
      path.join(fixtureRoot, "bundle-normalization.json")
    );

    await ingestFhirBatch({
      inputPath: fixtureRoot,
      runId: "run_norm_001",
      stagingRootPath: stagedRootPath,
      quarantineRootPath
    });

    const summary = await normalizeFhirStagedRun({
      runId: "run_norm_001",
      stagedRootPath,
      outputRootPath,
      profileVersion: "v-test"
    });

    expect(summary.patientCount).toBe(1);
    expect(summary.profileVersion).toBe("v-test");
    expect(summary.validationFailureCount).toBe(0);
    expect(summary.lineageCount).toBeGreaterThanOrEqual(6);
    expect(summary.missingLineageCount).toBe(0);

    const outputPath = path.join(outputRootPath, "run_norm_001", "patients", "patient-002.json");
    const context = JSON.parse(await readFile(outputPath, "utf8")) as NormalizedPatientContext;

    expect(context.patientId).toBe("patient-002");
    expect(context.profileVersion).toBe("v-test");
    expect(context.activeConditions).toHaveLength(1);
    expect(context.activeConditions[0].codeText).toBe("Type 2 diabetes");

    expect(context.activeMedications).toHaveLength(1);
    expect(context.activeMedications[0].name).toBe("Metformin");

    expect(context.careTasks.length).toBeGreaterThanOrEqual(1);
    expect(context.careTasks[0].description).toBe("Walk 30 minutes daily");

    expect(context.upcomingAppointments).toHaveLength(1);
    expect(context.upcomingAppointments[0].encounterId).toBe("encounter-future-001");

    expect(context.observations.length).toBeGreaterThanOrEqual(2);
    expect(context.sdohFlags).toHaveLength(1);
    expect(context.sdohFlags[0].flag).toBe("Housing stability");

    const report = JSON.parse(await readFile(summary.validationReportPath, "utf8")) as NormalizationValidationReport;
    expect(report.totalFailures).toBe(0);

    const lineageEntries = await queryNormalizationLineage({
      runId: "run_norm_001",
      outputRootPath,
      patientId: "patient-002"
    });
    expect(lineageEntries.length).toBeGreaterThanOrEqual(6);
    expect(lineageEntries[0].ingestionRunId).toBe("run_norm_001");
    expect(lineageEntries[0].transformationRuleVersion).toBe("v-test");
  });

  it("reports validation issues and continues normalizing valid records", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "fhir-normalization-validation-"));
    const fixtureRoot = path.join(workspace, "fixtures");
    const stagedRootPath = path.join(workspace, "staging");
    const quarantineRootPath = path.join(workspace, "quarantine");
    const outputRootPath = path.join(workspace, "normalized");

    await mkdir(fixtureRoot, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "bundle-normalization-malformed.json"),
      path.join(fixtureRoot, "bundle-normalization-malformed.json")
    );

    await ingestFhirBatch({
      inputPath: fixtureRoot,
      runId: "run_norm_validation_001",
      stagingRootPath: stagedRootPath,
      quarantineRootPath
    });

    const summary = await normalizeFhirStagedRun({
      runId: "run_norm_validation_001",
      stagedRootPath,
      outputRootPath,
      profileVersion: "v-test"
    });

    expect(summary.patientCount).toBe(1);
    expect(summary.validationFailureCount).toBe(4);
    expect(summary.validationFailuresByCategory.activeConditions).toBe(1);
    expect(summary.validationFailuresByCategory.activeMedications).toBe(1);
    expect(summary.validationFailuresByCategory.careTasks).toBe(1);
    expect(summary.validationFailuresByCategory.observations).toBe(1);

    const outputPath = path.join(outputRootPath, "run_norm_validation_001", "patients", "patient-003.json");
    const context = JSON.parse(await readFile(outputPath, "utf8")) as NormalizedPatientContext;

    expect(context.activeConditions).toHaveLength(1);
    expect(context.activeMedications).toHaveLength(1);
    expect(context.upcomingAppointments).toHaveLength(1);
    expect(context.observations.length).toBeGreaterThanOrEqual(1);
    expect(context.sdohFlags).toHaveLength(1);

    const report = JSON.parse(await readFile(summary.validationReportPath, "utf8")) as NormalizationValidationReport;
    expect(report.totalFailures).toBe(4);
    expect(report.failuresByCategory.activeConditions).toBe(1);
    expect(report.failuresByCategory.activeMedications).toBe(1);
    expect(report.failuresByCategory.careTasks).toBe(1);
    expect(report.failuresByCategory.observations).toBe(1);
    expect(report.failures[0].issues.length).toBeGreaterThanOrEqual(1);
    expect(report.failures[0].issues[0].field.length).toBeGreaterThan(0);
  });

  it("keeps reprocessing idempotent and queryable by run id", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "fhir-normalization-idempotent-"));
    const fixtureRoot = path.join(workspace, "fixtures");
    const stagedRootPath = path.join(workspace, "staging");
    const quarantineRootPath = path.join(workspace, "quarantine");
    const outputRootPath = path.join(workspace, "normalized");

    await mkdir(fixtureRoot, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "bundle-duplicates.json"),
      path.join(fixtureRoot, "bundle-duplicates.json")
    );

    await ingestFhirBatch({
      inputPath: fixtureRoot,
      runId: "run_norm_idempotent_001",
      stagingRootPath: stagedRootPath,
      quarantineRootPath
    });

    const firstSummary = await normalizeFhirStagedRun({
      runId: "run_norm_idempotent_001",
      stagedRootPath,
      outputRootPath,
      profileVersion: "v-test"
    });

    const secondSummary = await normalizeFhirStagedRun({
      runId: "run_norm_idempotent_001",
      stagedRootPath,
      outputRootPath,
      profileVersion: "v-test"
    });

    const outputPath = path.join(outputRootPath, "run_norm_idempotent_001", "patients", "patient-dup-001.json");
    const context = JSON.parse(await readFile(outputPath, "utf8")) as NormalizedPatientContext;

    expect(context.activeConditions).toHaveLength(1);
    expect(context.activeMedications).toHaveLength(1);
    expect(firstSummary.duplicateEventCount).toBe(0);
    expect(secondSummary.duplicateEventCount).toBe(0);

    const historyEntries = await queryNormalizationReprocessingHistory(
      "run_norm_idempotent_001",
      outputRootPath
    );
    expect(historyEntries.length).toBeGreaterThanOrEqual(2);
    expect(historyEntries[0].runId).toBe("run_norm_idempotent_001");
  });

  it("detects missing lineage entries in quality checks", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "fhir-normalization-lineage-quality-"));
    const fixtureRoot = path.join(workspace, "fixtures");
    const stagedRootPath = path.join(workspace, "staging");
    const quarantineRootPath = path.join(workspace, "quarantine");
    const outputRootPath = path.join(workspace, "normalized");

    await mkdir(fixtureRoot, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "fhir-batch", "bundle-normalization.json"),
      path.join(fixtureRoot, "bundle-normalization.json")
    );

    await ingestFhirBatch({
      inputPath: fixtureRoot,
      runId: "run_norm_lineage_001",
      stagingRootPath: stagedRootPath,
      quarantineRootPath
    });

    const summary = await normalizeFhirStagedRun({
      runId: "run_norm_lineage_001",
      stagedRootPath,
      outputRootPath,
      profileVersion: "v-test"
    });

    const lineageEntries = await queryNormalizationLineage({
      runId: "run_norm_lineage_001",
      outputRootPath
    });

    const trimmedLineage = lineageEntries.slice(1);
    const serializedTrimmed = trimmedLineage.map((entry) => JSON.stringify(entry)).join("\n");
    await writeFile(
      summary.lineagePath,
      serializedTrimmed ? `${serializedTrimmed}\n` : "",
      "utf8"
    );

    const quality = await validateLineageCoverageForRun("run_norm_lineage_001", outputRootPath);
    expect(quality.totalMissing).toBe(1);
    expect(quality.missingEntries[0].idempotencyKey.length).toBeGreaterThan(0);
  });
});
