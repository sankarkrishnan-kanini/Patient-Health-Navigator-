/**
 * Showcase Cohort Selection
 * Stub implementation - functionality moved to RAG pipeline
 * 
 * Original hardcoded cohort selection logic has been
 * removed. Consider using the RAG orchestrator for dynamic patient cohort generation.
 */

export interface ShowcaseCohort {
  cohortRunId: string;
  patientIds: string[];
  selectionCriteria: Record<string, unknown>;
  timestamp: string;
}

export interface SelectionCliArgs {
  sourceRunId?: string;
  runId?: string;
  normalizedRootPath?: string;
  outputRootPath?: string;
  minProfiles?: number;
  maxProfiles?: number;
  cohortRunId?: string;
  maxPatients?: number;
  selectionCriteria?: Record<string, unknown>;
}

export async function buildShowcaseCohort(
  args?: SelectionCliArgs | {
    cohortRunId?: string;
    maxPatients?: number;
    selectionCriteria?: Record<string, unknown>;
  }
): Promise<ShowcaseCohort> {
  console.warn(
    "[DEPRECATED] showcase-cohort-selection: Hardcoded cohort selection has been removed. " +
    "Use RAG pipeline for dynamic patient cohort generation."
  );

  const cohortRunId = (args as SelectionCliArgs)?.sourceRunId || (args as SelectionCliArgs)?.cohortRunId || "stub_cohort";

  return {
    cohortRunId,
    patientIds: [],
    selectionCriteria: (args as SelectionCliArgs)?.selectionCriteria || {},
    timestamp: new Date().toISOString()
  };
}

export async function selectPatientsByCondition(
  condition: string,
  options?: { maxPatients?: number }
): Promise<string[]> {
  console.warn("[DEPRECATED] selectPatientsByCondition: Use RAG pipeline instead");
  return [];
}
