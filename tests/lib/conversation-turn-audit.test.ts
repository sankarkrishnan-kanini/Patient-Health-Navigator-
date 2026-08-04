import { startConversationSession, resetConversationSessionStoreForTests } from "@/lib/chat-session";
import {
  appendConversationTurnAudit,
  getConversationTurnAuditCount,
  getConversationTurnAuditEntries,
  resetConversationTurnAuditStoreForTests
} from "@/lib/conversation-turn-audit";
import { AppError } from "@/lib/errors";

describe("conversation turn audit store", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
    resetConversationTurnAuditStoreForTests();
  });

  it("persists ordered user and assistant audit records for a conversation", () => {
    const session = startConversationSession({ selectedPatientId: "patient-401" });

    const records = appendConversationTurnAudit({
      conversationId: session.conversationId,
      userContentReference: "turn_ref_user_001",
      assistantContentReference: "turn_ref_assistant_001"
    });

    expect(records).toHaveLength(2);
    expect(getConversationTurnAuditCount(session.conversationId)).toBe(2);

    const storedRecords = getConversationTurnAuditEntries(session.conversationId);
    expect(storedRecords.map((record) => record.role)).toEqual(["user", "assistant"]);
    expect(storedRecords[0]).toMatchObject({
      conversationId: session.conversationId,
      role: "user",
      contentReference: "turn_ref_user_001"
    });
    expect(storedRecords[1]).toMatchObject({
      conversationId: session.conversationId,
      role: "assistant",
      contentReference: "turn_ref_assistant_001"
    });
    expect(storedRecords[0].timestamp).toContain("T");
    expect(storedRecords[1].timestamp).toContain("T");
  });

  it("requires an existing conversation session before writing audit records", () => {
    expect(() =>
      appendConversationTurnAudit({
        conversationId: "conv_20260803T000000Z_abcdef123456",
        userContentReference: "turn_ref_user_001",
        assistantContentReference: "turn_ref_assistant_001"
      })
    ).toThrow(AppError);
  });

  it("returns structured validation details for missing turn fields", () => {
    try {
      appendConversationTurnAudit({
        conversationId: " ",
        userContentReference: " ",
        assistantContentReference: ""
      });

      throw new Error("Expected appendConversationTurnAudit to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: "CONVERSATION_TURN_AUDIT_VALIDATION_FAILED",
        status: 400,
        details: {
          fields: [
            {
              field: "conversationId",
              issue: "invalid"
            },
            {
              field: "userContentReference",
              issue: "invalid"
            },
            {
              field: "assistantContentReference",
              issue: "invalid"
            }
          ]
        }
      });
    }
  });
});