import {
  appendConversationTurn,
  CONVERSATION_ID_REGEX,
  DEFAULT_TURN_MEMORY_WINDOW,
  getRecentConversationTurns,
  getConversationTurnCount,
  getConversationSessionById,
  resetConversationSession,
  resetConversationSessionStoreForTests,
  startConversationSession,
  updateConversationSessionBinding
} from "@/lib/chat-session";
import { AppError } from "@/lib/errors";

describe("chat session start", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
  });

  it("generates a unique session id for each start", () => {
    const ids = new Set<string>();

    for (let i = 0; i < 100; i += 1) {
      const session = startConversationSession({ selectedPatientId: "patient-400" });
      expect(CONVERSATION_ID_REGEX.test(session.conversationId)).toBe(true);
      expect(session.binding.patientId).toBe("patient-400");
      expect(session.binding.contextSnapshotRef).toBe("showcase-profile-summary:patient-400");
      ids.add(session.conversationId);
    }

    expect(ids.size).toBe(100);
  });

  it("accepts valid client conversation ids", () => {
    const session = startConversationSession({
      clientConversationId: "conv_20260730T120000Z_abcdef123456",
      selectedPatientId: "patient-401"
    });

    expect(session.conversationId).toBe("conv_20260730T120000Z_abcdef123456");
    expect(session.clientProvided).toBe(true);
    expect(session.binding.patientId).toBe("patient-401");
  });

  it("rejects malformed client conversation ids", () => {
    expect(() =>
      startConversationSession({
        clientConversationId: "session-123",
        selectedPatientId: "patient-400"
      })
    ).toThrow(AppError);

    expect(() =>
      startConversationSession({
        clientConversationId: "session-123",
        selectedPatientId: "patient-400"
      })
    ).toThrow("clientConversationId must match");
  });

  it("rejects reused client conversation ids", () => {
    startConversationSession({
      clientConversationId: "conv_20260730T120000Z_abcdef123456",
      selectedPatientId: "patient-400"
    });

    expect(() =>
      startConversationSession({
        clientConversationId: "conv_20260730T120000Z_abcdef123456",
        selectedPatientId: "patient-400"
      })
    ).toThrow("already been used");
  });

  it("rejects invalid selected patient ids", () => {
    expect(() => startConversationSession({ selectedPatientId: "patient-999" })).toThrow(AppError);
    expect(() => startConversationSession({ selectedPatientId: "patient-999" })).toThrow(
      "not available in the Synthea dataset"
    );
  });

  it("supports reading and updating binding by conversation id", () => {
    const started = startConversationSession({ selectedPatientId: "patient-400" });
    const read = getConversationSessionById(started.conversationId);

    expect(read.binding.patientId).toBe("patient-400");

    const updated = updateConversationSessionBinding({
      conversationId: started.conversationId,
      selectedPatientId: "patient-403"
    });

    expect(updated.binding.patientId).toBe("patient-403");
    expect(updated.binding.contextSnapshotRef).toBe("showcase-profile-summary:patient-403");
  });

  it("clears binding and turn memory on reset", () => {
    const started = startConversationSession({ selectedPatientId: "patient-400" });
    appendConversationTurn({
      conversationId: started.conversationId,
      userMessage: "u1",
      assistantMessage: "a1"
    });
    appendConversationTurn({
      conversationId: started.conversationId,
      userMessage: "u2",
      assistantMessage: "a2"
    });

    const reset = resetConversationSession(started.conversationId);
    const session = getConversationSessionById(started.conversationId);

    expect(reset.bindingCleared).toBe(true);
    expect(reset.clearedTurnCount).toBe(2);
    expect(reset.sessionState).toBe("ready_for_rebind");
    expect(session.binding).toBeNull();
    expect(getConversationTurnCount(started.conversationId)).toBe(0);
  });

  it("is idempotent for repeated reset calls", () => {
    const started = startConversationSession({ selectedPatientId: "patient-401" });
    appendConversationTurn({
      conversationId: started.conversationId,
      userMessage: "u1",
      assistantMessage: "a1"
    });

    const first = resetConversationSession(started.conversationId);
    const second = resetConversationSession(started.conversationId);

    expect(first.clearedTurnCount).toBe(1);
    expect(second.clearedTurnCount).toBe(0);
    expect(second.bindingCleared).toBe(false);
    expect(second.sessionState).toBe("ready_for_rebind");
  });

  it("returns a deterministic bounded recent-turn window", () => {
    const started = startConversationSession({ selectedPatientId: "patient-401" });

    for (let index = 0; index < DEFAULT_TURN_MEMORY_WINDOW + 2; index += 1) {
      appendConversationTurn({
        conversationId: started.conversationId,
        userMessage: `u${index}`,
        assistantMessage: `a${index}`,
        memoryContext: {
          domain: "general",
          entityReferences: [],
          confidence: "high"
        }
      });
    }

    const turns = getRecentConversationTurns(started.conversationId);
    expect(turns).toHaveLength(DEFAULT_TURN_MEMORY_WINDOW);
    expect(turns[0].userMessage).toBe("u2");
    expect(turns.at(-1)?.assistantMessage).toBe(`a${DEFAULT_TURN_MEMORY_WINDOW + 1}`);
  });
});