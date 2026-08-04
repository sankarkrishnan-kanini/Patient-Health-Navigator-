import {
  decryptGuardrailAuditEvent,
  getStoredGuardrailAuditEventsForTests,
  persistGuardrailActivationEvent,
  persistGuardrailEvaluationEvent,
  queryGuardrailActivationEvents,
  resetGuardrailActivationEventStoreForTests
} from "@/lib/guardrail-audit";
import { AppError } from "@/lib/errors";

describe("guardrail activation audit store", () => {
  beforeEach(() => {
    resetGuardrailActivationEventStoreForTests();
  });

  it("persists emergency guardrail events with identifiers and reason", () => {
    const event = persistGuardrailActivationEvent({
      conversationId: "conv_20260803T000000Z_abcdef123456",
      patientId: "patient-401",
      contextSnapshotRef: "showcase-profile-summary:patient-401",
      triggerReason: "emergency_trigger_match",
      ruleId: "ER-CHEST-PAIN-001",
      ruleIds: ["ER-CHEST-PAIN-001"],
      matchedExpressions: ["chest pain"],
      userTurnId: "turn-1",
      assistantResponseId: "asst-1"
    });

    expect(event.eventId).toContain("gr_evt_");
    expect(event.eventType).toBe("emergency_guardrail_activation");
    expect(event.triggerReason).toBe("emergency_trigger_match");
    expect(event.ruleId).toBe("ER-CHEST-PAIN-001");
    expect(event.userTurnId).toBe("turn-1");
    expect(event.assistantResponseId).toBe("asst-1");
    expect(event.encryptionKeyVersion).toBeTruthy();
  });

  it("fails persistence validation when required fields are missing", () => {
    expect(() =>
      persistGuardrailActivationEvent({
        conversationId: " ",
        patientId: "patient-401",
        contextSnapshotRef: "showcase-profile-summary:patient-401",
        triggerReason: "emergency_trigger_match",
        ruleId: "ER-CHEST-PAIN-001",
        ruleIds: ["ER-CHEST-PAIN-001"],
        matchedExpressions: ["chest pain"],
        userTurnId: "turn-1",
        assistantResponseId: "asst-1"
      })
    ).toThrow(AppError);
  });

  it("returns structured validation details for invalid guardrail activation fields", () => {
    try {
      persistGuardrailActivationEvent({
        conversationId: "",
        patientId: " ",
        contextSnapshotRef: "",
        triggerReason: "not_allowed" as never,
        ruleId: "",
        ruleIds: [],
        matchedExpressions: [],
        userTurnId: "turn-1",
        assistantResponseId: "asst-1"
      });

      throw new Error("Expected persistGuardrailActivationEvent to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: "GUARDRAIL_AUDIT_VALIDATION_FAILED",
        status: 400,
        details: {
          fields: [
            {
              field: "conversationId",
              issue: "invalid"
            },
            {
              field: "patientId",
              issue: "invalid"
            },
            {
              field: "contextSnapshotRef",
              issue: "invalid"
            },
            {
              field: "triggerReason",
              issue: "invalid"
            },
            {
              field: "ruleId",
              issue: "invalid"
            },
            {
              field: "ruleIds",
              issue: "invalid"
            },
            {
              field: "matchedExpressions",
              issue: "invalid"
            }
          ]
        }
      });
    }
  });

  it("returns persisted events through query filters", () => {
    persistGuardrailActivationEvent({
      conversationId: "conv_20260803T000000Z_abcdef123456",
      patientId: "patient-401",
      contextSnapshotRef: "showcase-profile-summary:patient-401",
      triggerReason: "emergency_trigger_match",
      ruleId: "ER-CHEST-PAIN-001",
      ruleIds: ["ER-CHEST-PAIN-001"],
      matchedExpressions: ["chest pain"],
      userTurnId: "turn-1",
      assistantResponseId: "asst-1"
    });

    persistGuardrailActivationEvent({
      conversationId: "conv_20260803T000000Z_654321fedcba",
      patientId: "patient-402",
      contextSnapshotRef: "showcase-profile-summary:patient-402",
      triggerReason: "emergency_trigger_match",
      ruleId: "ER-BREATHING-001",
      ruleIds: ["ER-BREATHING-001"],
      matchedExpressions: ["trouble breathing"],
      userTurnId: "turn-2",
      assistantResponseId: "asst-2"
    });

    const filtered = queryGuardrailActivationEvents({
      conversationId: "conv_20260803T000000Z_abcdef123456"
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].ruleId).toBe("ER-CHEST-PAIN-001");
  });

  it("encrypts sensitive fields in storage and decrypts them on read", () => {
    const persisted = persistGuardrailEvaluationEvent({
      conversationId: "conv_20260803T000000Z_abcdef123456",
      patientId: "patient-401",
      contextSnapshotRef: "showcase-profile-summary:patient-401",
      evaluationName: "diagnosis_boundary",
      triggered: false,
      reason: "no_diagnosis_intent_detected",
      ruleId: "DX-BOUNDARY-UNKNOWN",
      ruleIds: ["DX-BOUNDARY-UNKNOWN"],
      matchedExpressions: ["hello there"],
      userTurnId: "turn-1",
      assistantResponseId: "asst-1"
    });

    const stored = getStoredGuardrailAuditEventsForTests()[0];
    expect(stored.sensitive.ciphertext).not.toContain("patient-401");
    expect(stored.sensitive.keyVersion).toBeTruthy();

    const decrypted = decryptGuardrailAuditEvent(stored);
    expect(decrypted).toMatchObject({
      eventType: "guardrail_evaluation",
      conversationId: "conv_20260803T000000Z_abcdef123456",
      patientId: "patient-401",
      contextSnapshotRef: "showcase-profile-summary:patient-401",
      evaluationName: "diagnosis_boundary",
      triggered: false,
      reason: "no_diagnosis_intent_detected",
      ruleId: "DX-BOUNDARY-UNKNOWN"
    });
    expect(persisted.encryptionKeyVersion).toBe(stored.sensitive.keyVersion);
  });

  it("persists non-triggered guardrail evaluation metadata", () => {
    const event = persistGuardrailEvaluationEvent({
      conversationId: "conv_20260803T000000Z_abcdef123456",
      patientId: "patient-401",
      contextSnapshotRef: "showcase-profile-summary:patient-401",
      evaluationName: "diagnosis_boundary",
      triggered: false,
      reason: "no_diagnosis_intent_detected",
      ruleId: "DX-BOUNDARY-UNKNOWN",
      ruleIds: ["DX-BOUNDARY-UNKNOWN"],
      matchedExpressions: ["hello there"],
      userTurnId: "turn-1",
      assistantResponseId: "asst-1"
    });

    expect(event.eventType).toBe("guardrail_evaluation");
    expect(event.triggered).toBe(false);
    expect(event.reason).toBe("no_diagnosis_intent_detected");
    expect(event.evaluationName).toBe("diagnosis_boundary");
  });
});
