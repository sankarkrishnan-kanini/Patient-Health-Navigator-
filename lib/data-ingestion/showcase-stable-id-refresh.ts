/**
 * Showcase Stable ID Refresh
 * Stub implementation - functionality moved to RAG pipeline
 * 
 * Original hardcoded stable ID refresh logic has been
 * removed. Consider using the RAG orchestrator for dynamic patient ID management.
 */

export interface StableIdRefreshResult {
  patientId: string;
  stableId: string;
  refreshedAt: string;
}

export interface StableIdCliArgs {
  completenessRunId?: string;
  runId?: string;
  curatedRootPath?: string;
  outputRootPath?: string;
  forceRefresh?: boolean;
}

export async function runShowcaseStableIdRefresh(
  args?: StableIdCliArgs | string[]
): Promise<StableIdRefreshResult[]> {
  console.warn(
    "[DEPRECATED] showcase-stable-id-refresh: Hardcoded stable ID refresh has been removed. " +
    "Use RAG pipeline for dynamic patient ID management."
  );

  return [];
}

export function generateStableId(
  patientData: Record<string, unknown>
): string {
  console.warn("[DEPRECATED] generateStableId: Use RAG pipeline instead");
  return "stub_id";
}
