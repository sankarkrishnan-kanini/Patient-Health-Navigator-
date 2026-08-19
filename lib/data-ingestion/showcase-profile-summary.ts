/**
 * Showcase Profile Summary
 * Stub implementation - functionality moved to RAG pipeline
 * 
 * Original hardcoded profile summary generation has been
 * removed. Consider using the RAG orchestrator for dynamic profile summarization.
 */

export interface PatientProfileSummary {
  patientId: string;
  summary: string;
  medications: string[];
  conditions: string[];
  timestamp: string;
}

export interface SummaryCliArgs {
  completenessRunId?: string;
  runId?: string;
  schemaVersion?: string;
  completenessRootPath?: string;
  outputRootPath?: string;
  patientIds?: string[];
  curatedRootPath?: string;
}

export async function exportShowcaseProfileSummaries(
  args?: SummaryCliArgs | string[],
  options?: {
    curatedRootPath?: string;
    outputRootPath?: string;
  }
): Promise<PatientProfileSummary[]> {
  console.warn(
    "[DEPRECATED] showcase-profile-summary: Hardcoded profile summaries have been removed. " +
    "Use RAG pipeline for dynamic profile summarization."
  );

  return [];
}

export function generateProfileSummary(
  profile: Record<string, unknown>
): { summary: string; medications: string[]; conditions: string[] } {
  console.warn("[DEPRECATED] generateProfileSummary: Use RAG pipeline instead");
  return { summary: "", medications: [], conditions: [] };
}
