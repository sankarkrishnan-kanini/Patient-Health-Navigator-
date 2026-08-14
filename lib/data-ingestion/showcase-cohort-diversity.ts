/**
 * Showcase Cohort Diversity
 * Stub implementation - functionality moved to RAG pipeline
 * 
 * Original hardcoded clinical scenario diversity rules have been
 * removed. Consider using the RAG orchestrator for dynamic scenario generation.
 */

export type ClinicalScenarioCategory = 
  | "type2_diabetes"
  | "hypertension"
  | "heart_failure"
  | "copd"
  | "asthma"
  | "arthritis"
  | "depression"
  | "other";

export interface CohortDiversityArgs {
  cohortRunId: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  requiredCategories?: ClinicalScenarioCategory[];
  maxCategoryShare?: number;
}

export async function applyShowcaseCohortDiversityRules(
  args: CohortDiversityArgs | string,
  options?: {
    maxCategoryShare?: number;
    requiredCategories?: ClinicalScenarioCategory[];
    curatedRootPath?: string;
    outputRootPath?: string;
  }
): Promise<{ success: boolean; message: string; summary?: Record<string, number> }> {
  console.warn(
    "[DEPRECATED] showcase-cohort-diversity: Hardcoded diversity rules have been removed. " +
    "Use RAG pipeline for dynamic clinical scenario generation."
  );

  const cohortRunId = typeof args === "string" ? args : args?.cohortRunId;

  return {
    success: false,
    message: "This stub function is deprecated. Use the RAG pipeline instead.",
    summary: {}
  };
}

export function validateClinicalDiversity(
  scenarios: Array<{ category: ClinicalScenarioCategory }>
): boolean {
  console.warn("[DEPRECATED] validateClinicalDiversity: Use RAG pipeline validation instead");
  return true;
}
