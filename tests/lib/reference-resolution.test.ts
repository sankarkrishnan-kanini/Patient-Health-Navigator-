import { resolveFollowUpReference } from "@/lib/showcase/reference-resolution";
import type { ConversationTurnRecord } from "@/lib/chat-session";

const appointmentTurn: ConversationTurnRecord = {
  userMessage: "When is my next appointment?",
  assistantMessage: "Based on your active profile, here are your upcoming visit details.",
  domain: "appointment",
  entityReferences: ["encounter-1"],
  confidence: "high"
};

describe("reference resolution", () => {
  it("resolves shorthand follow-up from prior turn domain", () => {
    const result = resolveFollowUpReference("When is it?", [appointmentTurn]);

    expect(result.confidence).toBe("high");
    expect(result.inferredDomain).toBe("appointment");
    expect(result.resolvedMessage).toBe("When is my next appointment?");
  });

  it("returns low-confidence fallback when no usable prior turn exists", () => {
    const result = resolveFollowUpReference("What about that?", []);

    expect(result.confidence).toBe("low");
    expect(result.fallbackMessage).toContain("I want to make sure I follow you");
  });

  it("does not override direct intent messages", () => {
    const result = resolveFollowUpReference("What medications am I taking?", [appointmentTurn]);

    expect(result.confidence).toBe("none");
    expect(result.resolvedMessage).toBeNull();
  });
});
