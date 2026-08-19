import { buildGuardrailAnalytics } from "@/lib/guardrail-analytics";
import type { GuardrailAuditEvent } from "@/lib/guardrail-audit";

function createEvaluation(
  evaluationName: "emergency_trigger" | "medication_boundary" | "diagnosis_boundary",
  triggered: boolean
): GuardrailAuditEvent {
  return {
    eventId: `event-${evaluationName}-${triggered}`,
    eventType: "guardrail_evaluation",
    timestamp: "2026-08-19T10:00:00.000Z",
    conversationId: "conversation-1",
    patientId: "patient-1",
    contextSnapshotRef: "snapshot-1",
    evaluationName,
    triggered,
    reason: "test",
    ruleId: "rule-1",
    ruleIds: ["rule-1"],
    matchedExpressions: ["test"],
    userTurnId: "turn-1",
    assistantResponseId: "response-1",
    encryptionKeyVersion: "v1"
  };
}

describe("buildGuardrailAnalytics", () => {
  it("separates life-threatening, dosage, and normal evaluations", () => {
    const analytics = buildGuardrailAnalytics([
      createEvaluation("emergency_trigger", true),
      createEvaluation("medication_boundary", true),
      createEvaluation("diagnosis_boundary", false)
    ]);

    expect(analytics.categories).toEqual({ critical: 1, medication: 1, normal: 1 });
    expect(analytics.totalEvaluations).toBe(3);
    expect(analytics.flaggedEvaluations).toBe(2);
  });
});