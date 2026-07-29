import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CohortProfile = {
  profileId: string;
  patientId: string;
  sourceRunId: string;
  profileVersion: string;
  sourceFile: string;
};

type PatientContext = {
  patientId: string;
  activeConditions?: unknown[];
  activeMedications?: unknown[];
  careTasks?: unknown[];
  upcomingAppointments?: unknown[];
  observations?: unknown[];
};

export type ClinicalScenarioCategory =
  | "chronic-care"
  | "preventive-care"
  | "symptom-oriented"
  | "general";

export type TaggedCohortProfile = CohortProfile & {
  categories: ClinicalScenarioCategory[];
  primaryCategory: ClinicalScenarioCategory;
};

export type DiversityViolation = {
  code: "MISSING_REQUIRED_CATEGORY" | "CATEGORY_DOMINANCE";
  message: string;
  details: Record<string, unknown>;
};

export type ShowcaseCohortDiversitySummary = {
  runId: string;
  cohortRunId: string;
  cohortOutputDirectory: string;
  outputDirectory: string;
  totalProfiles: number;
  requiredCategories: ClinicalScenarioCategory[];
  categoryDistribution: Record<ClinicalScenarioCategory, number>;
  categoryShare: Record<ClinicalScenarioCategory, number>;
  maxCategoryShare: number;
  violations: DiversityViolation[];
  isCompliant: boolean;
  finalized: boolean;
  taggedProfilesPath: string;
  diversityReportPath: string;
  finalizedProfilesPath: string;
  completedAt: string;
};

export type ShowcaseCohortDiversityOptions = {
  cohortRunId: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  requiredCategories?: ClinicalScenarioCategory[];
  maxCategoryShare?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function defaultRunId(): string {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  return `diversity_${stamp}`;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function inferCategories(context: PatientContext): ClinicalScenarioCategory[] {
  const categories: ClinicalScenarioCategory[] = [];

  if (toArray(context.activeConditions).length > 0 || toArray(context.activeMedications).length > 0) {
    categories.push("chronic-care");
  }

  if (toArray(context.careTasks).length > 0) {
    categories.push("preventive-care");
  }

  if (toArray(context.upcomingAppointments).length > 0 || toArray(context.observations).length > 0) {
    categories.push("symptom-oriented");
  }

  if (categories.length === 0) {
    categories.push("general");
  }

  return categories;
}

function primaryCategory(categories: ClinicalScenarioCategory[]): ClinicalScenarioCategory {
  if (categories.includes("chronic-care")) {
    return "chronic-care";
  }

  if (categories.includes("preventive-care")) {
    return "preventive-care";
  }

  if (categories.includes("symptom-oriented")) {
    return "symptom-oriented";
  }

  return "general";
}

function emptyDistribution(): Record<ClinicalScenarioCategory, number> {
  return {
    "chronic-care": 0,
    "preventive-care": 0,
    "symptom-oriented": 0,
    general: 0
  };
}

function shareDistribution(
  distribution: Record<ClinicalScenarioCategory, number>,
  totalProfiles: number
): Record<ClinicalScenarioCategory, number> {
  if (totalProfiles === 0) {
    return {
      "chronic-care": 0,
      "preventive-care": 0,
      "symptom-oriented": 0,
      general: 0
    };
  }

  return {
    "chronic-care": distribution["chronic-care"] / totalProfiles,
    "preventive-care": distribution["preventive-care"] / totalProfiles,
    "symptom-oriented": distribution["symptom-oriented"] / totalProfiles,
    general: distribution.general / totalProfiles
  };
}

export async function applyShowcaseCohortDiversityRules(
  options: ShowcaseCohortDiversityOptions
): Promise<ShowcaseCohortDiversitySummary> {
  const runId = options.runId ?? defaultRunId();
  const curatedRootPath =
    options.curatedRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-cohort");
  const outputRootPath =
    options.outputRootPath ?? path.join(".propel", "context", "data", "curated", "showcase-cohort-diversity");
  const requiredCategories = options.requiredCategories ?? ["chronic-care", "preventive-care"];
  const maxCategoryShare = options.maxCategoryShare ?? 0.6;

  const cohortOutputDirectory = path.join(curatedRootPath, options.cohortRunId);
  const outputDirectory = path.join(outputRootPath, runId);
  const taggedProfilesPath = path.join(outputDirectory, "tagged-cohort-profiles.json");
  const diversityReportPath = path.join(outputDirectory, "diversity-report.json");
  const finalizedProfilesPath = path.join(outputDirectory, "finalized-cohort-profiles.json");

  await mkdir(outputDirectory, { recursive: true });

  const profilesPath = path.join(cohortOutputDirectory, "cohort-profiles.json");
  const profiles = JSON.parse(await readFile(profilesPath, "utf8")) as CohortProfile[];

  const taggedProfiles: TaggedCohortProfile[] = [];
  for (const profile of profiles) {
    const context = JSON.parse(await readFile(profile.sourceFile, "utf8")) as PatientContext;
    const categories = inferCategories(context);
    taggedProfiles.push({
      ...profile,
      categories,
      primaryCategory: primaryCategory(categories)
    });
  }

  const distribution = emptyDistribution();
  for (const profile of taggedProfiles) {
    distribution[profile.primaryCategory] += 1;
  }

  const categoryShare = shareDistribution(distribution, taggedProfiles.length);
  const violations: DiversityViolation[] = [];

  for (const category of requiredCategories) {
    if (distribution[category] === 0) {
      violations.push({
        code: "MISSING_REQUIRED_CATEGORY",
        message: `Required clinical category '${category}' is not represented in the cohort.`,
        details: { category }
      });
    }
  }

  for (const [category, share] of Object.entries(categoryShare) as Array<
    [ClinicalScenarioCategory, number]
  >) {
    if (share > maxCategoryShare) {
      violations.push({
        code: "CATEGORY_DOMINANCE",
        message: `Category '${category}' dominates cohort with share ${(share * 100).toFixed(1)}%.`,
        details: { category, share, maxCategoryShare }
      });
    }
  }

  const isCompliant = violations.length === 0;
  const finalized = isCompliant;

  await writeFile(taggedProfilesPath, JSON.stringify(taggedProfiles, null, 2), "utf8");
  if (finalized) {
    await writeFile(finalizedProfilesPath, JSON.stringify(taggedProfiles, null, 2), "utf8");
  }

  const summary: ShowcaseCohortDiversitySummary = {
    runId,
    cohortRunId: options.cohortRunId,
    cohortOutputDirectory,
    outputDirectory,
    totalProfiles: taggedProfiles.length,
    requiredCategories,
    categoryDistribution: distribution,
    categoryShare,
    maxCategoryShare,
    violations,
    isCompliant,
    finalized,
    taggedProfilesPath,
    diversityReportPath,
    finalizedProfilesPath,
    completedAt: nowIso()
  };

  await writeFile(diversityReportPath, JSON.stringify(summary, null, 2), "utf8");
  return summary;
}
