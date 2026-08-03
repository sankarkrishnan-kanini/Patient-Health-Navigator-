import {
  persistGuardrailActivationEvent,
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
});
