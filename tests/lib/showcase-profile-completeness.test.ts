import { cp, mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildShowcaseCohort } from "@/lib/data-ingestion/showcase-cohort-selection";
import { runShowcaseProfileCompletenessGate } from "@/lib/data-ingestion/showcase-profile-completeness";

describe("Showcase profile completeness gate", () => {
  it("passes complete profiles and emits versioned report artifacts", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-completeness-pass-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const curatedRootPath = path.join(workspace, "curated");
    const outputRootPath = path.join(workspace, "completeness");
    const sourcePatientsPath = path.join(normalizedRootPath, "run_showcase_diverse", "patients");

    await mkdir(sourcePatientsPath, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "showcase-cohort", "run_showcase_diverse", "patients"),
      sourcePatientsPath,
      { recursive: true }
    );

    await buildShowcaseCohort({
      sourceRunId: "run_showcase_diverse",
      runId: "cohort_complete_001",
      normalizedRootPath,
      outputRootPath: curatedRootPath,
      minProfiles: 5,
      maxProfiles: 10
    });

    const summary = await runShowcaseProfileCompletenessGate({
      cohortRunId: "cohort_complete_001",
      runId: "completeness_run_001",
      curatedRootPath,
      outputRootPath,
      checklistVersion: "v1.1"
    });

    expect(summary.checklist.version).toBe("v1.1");
    expect(summary.scannedProfiles).toBe(6);
    expect(summary.passedProfiles).toBe(6);
    expect(summary.rejectedProfiles).toBe(0);
    expect(summary.passRate).toBe(1);
  });

  it("rejects incomplete profiles with detailed missing-field diagnostics", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-completeness-fail-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const curatedRootPath = path.join(workspace, "curated");
    const outputRootPath = path.join(workspace, "completeness");
    const sourcePatientsPath = path.join(normalizedRootPath, "run_showcase_seed", "patients");

    await mkdir(sourcePatientsPath, { recursive: true });
    await cp(
      path.join(process.cwd(), "tests", "fixtures", "showcase-cohort", "run_showcase_seed", "patients"),
      sourcePatientsPath,
      { recursive: true }
    );

    await buildShowcaseCohort({
      sourceRunId: "run_showcase_seed",
      runId: "cohort_complete_002",
      normalizedRootPath,
      outputRootPath: curatedRootPath,
      minProfiles: 5,
      maxProfiles: 10
    });

    const summary = await runShowcaseProfileCompletenessGate({
      cohortRunId: "cohort_complete_002",
      runId: "completeness_run_002",
      curatedRootPath,
      outputRootPath
    });

    expect(summary.scannedProfiles).toBe(6);
    expect(summary.passedProfiles).toBe(0);
    expect(summary.rejectedProfiles).toBe(6);
    expect(summary.passRate).toBe(0);
  });
});
