import { cp, mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildShowcaseCohort } from "@/lib/data-ingestion/showcase-cohort-selection";
import { runShowcaseProfileCompletenessGate } from "@/lib/data-ingestion/showcase-profile-completeness";
import {
  createProfileSummaryPayload,
  exportShowcaseProfileSummaries,
  validateProfileSummaryPayload
} from "@/lib/data-ingestion/showcase-profile-summary";

describe("Showcase profile summary payload contract", () => {
  it("exports one summary object per selected profile", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-summary-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const curatedRootPath = path.join(workspace, "curated");
    const completenessRootPath = path.join(workspace, "completeness");
    const summaryRootPath = path.join(workspace, "summary");
    const sourcePatientsPath = path.join(normalizedRootPath, "run_showcase_diverse", "patients");

    await mkdir(sourcePatientsPath, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "showcase-cohort", "run_showcase_diverse", "patients"),
      sourcePatientsPath,
      { recursive: true }
    );

    await buildShowcaseCohort({
      sourceRunId: "run_showcase_diverse",
      runId: "cohort_summary_001",
      normalizedRootPath,
      outputRootPath: curatedRootPath,
      minProfiles: 5,
      maxProfiles: 10
    });

    await runShowcaseProfileCompletenessGate({
      cohortRunId: "cohort_summary_001",
      runId: "complete_summary_001",
      curatedRootPath,
      outputRootPath: completenessRootPath,
      checklistVersion: "v1.1"
    });

    const exportSummary = await exportShowcaseProfileSummaries({
      completenessRunId: "complete_summary_001",
      runId: "summary_export_001",
      schemaVersion: "v1.0",
      completenessRootPath,
      outputRootPath: summaryRootPath
    });

    expect(exportSummary.selectedProfiles).toBe(6);
    expect(exportSummary.generatedSummaries).toBe(6);
    expect(exportSummary.validationFailures).toBe(0);
  });

  it("flags malformed payload fields during validation", () => {
    const payload = createProfileSummaryPayload(
      {
        profileId: "patient-999",
        patientId: "patient-999",
        sourceRunId: "run_x",
        profileVersion: "v1",
        sourceFile: "x"
      },
      {
        patientId: "patient-999",
        profileVersion: "v1",
        sourceRunId: "run_x",
        generatedAt: "2026-07-29T00:00:00.000Z",
        activeConditions: [],
        activeMedications: [],
        careTasks: [],
        upcomingAppointments: [],
        observations: [],
        sdohFlags: []
      }
    );

    const malformed = {
      ...payload,
      schemaVersion: "",
      profileId: "",
      highlights: {
        ...payload.highlights,
        topConditions: "bad"
      }
    } as unknown as typeof payload;

    const issues = validateProfileSummaryPayload(malformed);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(issues.some((issue) => issue.field === "schemaVersion")).toBe(true);
    expect(issues.some((issue) => issue.field === "profileId")).toBe(true);
    expect(issues.some((issue) => issue.field === "highlights.topConditions")).toBe(true);
  });
});
