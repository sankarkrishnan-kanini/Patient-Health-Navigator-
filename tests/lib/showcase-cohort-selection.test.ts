import { cp, mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildShowcaseCohort } from "@/lib/data-ingestion/showcase-cohort-selection";

describe("Showcase cohort selection", () => {
  it("selects 5 to 10 stable profiles and logs failed records", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-cohort-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const outputRootPath = path.join(workspace, "curated");
    const sourcePatientsPath = path.join(normalizedRootPath, "run_showcase_seed", "patients");

    await mkdir(sourcePatientsPath, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "showcase-cohort", "run_showcase_seed", "patients"),
      sourcePatientsPath,
      { recursive: true }
    );

    const summary = await buildShowcaseCohort({
      sourceRunId: "run_showcase_seed",
      runId: "cohort_test_001",
      normalizedRootPath,
      outputRootPath,
      minProfiles: 5,
      maxProfiles: 10
    });

    expect(summary.selectedPatientCount).toBe(6);
    expect(summary.selectedProfiles.length).toBeGreaterThanOrEqual(5);
    expect(summary.selectedProfiles.length).toBeLessThanOrEqual(10);
    expect(summary.selectedProfiles[0].patientId).toBe("patient-100");
    expect(summary.failedRecords).toHaveLength(1);

    const idList = await readFile(summary.selectedProfileIdsPath, "utf8");
    const ids = idList
      .trim()
      .split("\n")
      .filter((value) => value.length > 0);

    expect(ids).toEqual([
      "patient-100",
      "patient-101",
      "patient-102",
      "patient-103",
      "patient-104",
      "patient-105"
    ]);
  });

  it("fails when minimum cohort size is not met", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-cohort-small-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const outputRootPath = path.join(workspace, "curated");
    const sourcePatientsPath = path.join(normalizedRootPath, "run_small", "patients");

    await mkdir(sourcePatientsPath, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "showcase-cohort", "run_showcase_seed", "patients", "patient-100.json"),
      path.join(sourcePatientsPath, "patient-100.json")
    );

    await expect(
      buildShowcaseCohort({
        sourceRunId: "run_small",
        runId: "cohort_test_002",
        normalizedRootPath,
        outputRootPath,
        minProfiles: 5,
        maxProfiles: 10
      })
    ).rejects.toThrow("minimum required is 5");
  });
});
