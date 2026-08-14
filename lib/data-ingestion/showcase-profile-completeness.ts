/**
 * Showcase Profile Completeness
 * Stub implementation - functionality moved to RAG pipeline
 * 
 * Original hardcoded profile completeness checks have been
 * removed. Consider using the RAG orchestrator for dynamic profile enrichment.
 */

export interface ProfileCompletenessResult {
  patientId: string;
  completenessScore: number; // 0-100
  missingFields: string[];
  timestamp: string;
}

export interface CompletenessCliArgs {
  cohortRunId?: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  checklistVersion?: string;
  patientIds?: string[];
  minCompleteness?: number;
}

export async function runShowcaseProfileCompletenessGate(
  args?: CompletenessCliArgs | string[],
  options?: {
    minCompleteness?: number;
    curatedRootPath?: string;
    outputRootPath?: string;
  }
): Promise<ProfileCompletenessResult[]> {
  console.warn(
    "[DEPRECATED] showcase-profile-completeness: Hardcoded profile checks have been removed. " +
    "Use RAG pipeline for dynamic profile enrichment."
  );

  return [];
}

export function assessProfileCompleteness(
  profile: Record<string, unknown>
): { score: number; missingFields: string[] } {
  console.warn("[DEPRECATED] assessProfileCompleteness: Use RAG pipeline instead");
  return { score: 0, missingFields: [] };
}
