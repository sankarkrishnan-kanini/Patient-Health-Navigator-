export type ModelGenerationInvocation = {
  conversationId: string;
  patientId: string;
  message: string;
};

export function invokeModelGeneration(_invocation: ModelGenerationInvocation): string | null {
  // Placeholder orchestration hook for model invocation.
  // This is intentionally side-effect free in showcase mode.
  return null;
}
