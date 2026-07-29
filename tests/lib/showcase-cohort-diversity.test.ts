import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildShowcaseCohort } from "@/lib/data-ingestion/showcase-cohort-selection";
import { applyShowcaseCohortDiversityRules } from "@/lib/data-ingestion/showcase-cohort-diversity";

type SeedPatient = {
  patientId: string;
  activeConditions?: unknown[];
  activeMedications?: unknown[];
  careTasks?: unknown[];
  upcomingAppointments?: unknown[];
  observations?: unknown[];
};

async function writePatient(filePath: string, patient: SeedPatient): Promise<void> {
  await writeFile(
    filePath,
    JSON.stringify(
      {
        patientId: patient.patientId,
        profileVersion: "v-cohort",
        sourceRunId: "run_diverse_seed",
        activeConditions: patient.activeConditions ?? [],
        activeMedications: patient.activeMedications ?? [],
        careTasks: patient.careTasks ?? [],
        upcomingAppointments: patient.upcomingAppointments ?? [],
        observations: patient.observations ?? []
      },
      null,
      2
    ),
    "utf8"
  );
}

describe("Showcase cohort diversity", () => {
  it("passes when cohort covers required categories without dominance", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-diversity-pass-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const curatedRootPath = path.join(workspace, "curated");
    const outputRootPath = path.join(workspace, "diversity");
    const sourcePath = path.join(normalizedRootPath, "run_diverse_seed", "patients");

    await mkdir(sourcePath, { recursive: true });

    await writePatient(path.join(sourcePath, "patient-200.json"), {
      patientId: "patient-200",
      activeConditions: [{ id: "c1" }]
    });
    await writePatient(path.join(sourcePath, "patient-201.json"), {
      patientId: "patient-201",
      activeMedications: [{ id: "m1" }]
    });
    await writePatient(path.join(sourcePath, "patient-202.json"), {
      patientId: "patient-202",
      careTasks: [{ id: "t1" }]
    });
    await writePatient(path.join(sourcePath, "patient-203.json"), {
      patientId: "patient-203",
      careTasks: [{ id: "t2" }],
      upcomingAppointments: [{ id: "e1" }]
    });
    await writePatient(path.join(sourcePath, "patient-204.json"), {
      patientId: "patient-204",
      observations: [{ id: "o1" }]
    });
    await writePatient(path.join(sourcePath, "patient-205.json"), {
      patientId: "patient-205"
    });

    await buildShowcaseCohort({
      sourceRunId: "run_diverse_seed",
      runId: "cohort_diverse_001",
      normalizedRootPath,
      outputRootPath: curatedRootPath,
      minProfiles: 5,
      maxProfiles: 10
    });

    const summary = await applyShowcaseCohortDiversityRules({
      cohortRunId: "cohort_diverse_001",
      runId: "diversity_run_001",
      curatedRootPath,
      outputRootPath,
      requiredCategories: ["chronic-care", "preventive-care"],
      maxCategoryShare: 0.6
    });

    expect(summary.totalProfiles).toBe(6);
    expect(summary.isCompliant).toBe(true);
    expect(summary.finalized).toBe(true);
    expect(summary.violations).toHaveLength(0);
    expect(summary.categoryDistribution["chronic-care"]).toBe(2);
    expect(summary.categoryDistribution["preventive-care"]).toBe(2);
    expect(summary.categoryDistribution["symptom-oriented"]).toBe(1);
    expect(summary.categoryDistribution.general).toBe(1);
  });

  it("flags rule violations when a single category dominates", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "showcase-diversity-fail-"));
    const normalizedRootPath = path.join(workspace, "normalized");
    const curatedRootPath = path.join(workspace, "curated");
    const outputRootPath = path.join(workspace, "diversity");
    const sourcePath = path.join(normalizedRootPath, "run_dominated_seed", "patients");

    await mkdir(sourcePath, { recursive: true });
    for (let index = 0; index < 6; index += 1) {
      const patientId = `patient-3${index}`;
      await writePatient(path.join(sourcePath, `${patientId}.json`), {
        patientId,
        activeConditions: [{ id: `c${index}` }]
      });
    }

    await buildShowcaseCohort({
      sourceRunId: "run_dominated_seed",
      runId: "cohort_diverse_002",
      normalizedRootPath,
      outputRootPath: curatedRootPath,
      minProfiles: 5,
      maxProfiles: 10
    });

    const summary = await applyShowcaseCohortDiversityRules({
      cohortRunId: "cohort_diverse_002",
      runId: "diversity_run_002",
      curatedRootPath,
      outputRootPath,
      requiredCategories: ["chronic-care", "preventive-care"],
      maxCategoryShare: 0.6
    });

    expect(summary.isCompliant).toBe(false);
    expect(summary.finalized).toBe(false);
    expect(summary.violations.length).toBeGreaterThanOrEqual(2);
    expect(summary.violations.some((violation) => violation.code === "CATEGORY_DOMINANCE")).toBe(true);
    expect(
      summary.violations.some((violation) => violation.code === "MISSING_REQUIRED_CATEGORY")
    ).toBe(true);
  });
});
