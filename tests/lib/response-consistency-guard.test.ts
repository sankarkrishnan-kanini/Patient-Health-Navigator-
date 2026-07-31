import { applyResponseConsistencyGuard } from "@/lib/showcase/response-consistency-guard";
import type { ConversationTurnRecord } from "@/lib/chat-session";

describe("response consistency guard", () => {
  it("detects contradiction and rewrites using recent consistent turn", () => {
    const recentTurns: ConversationTurnRecord[] = [
      {
        userMessage: "When is my next appointment?",
        assistantMessage: "Based on your active profile, here are your upcoming visit details:\n- Visit encounter-1: 2099-01-01T00:00:00Z (planned).",
        domain: "appointment",
        entityReferences: ["encounter-1"],
        confidence: "high"
      }
    ];

    const result = applyResponseConsistencyGuard({
      draftResponse:
        "I checked your active profile and there are no upcoming visits listed right now. If this seems out of date, please confirm your profile or check with your care team.",
      domain: "appointment",
      entityReferences: [],
      recentTurns
    });

    expect(result.contradictionDetected).toBe(true);
    expect(result.rewriteApplied).toBe(true);
    expect(result.fallbackApplied).toBe(false);
    expect(result.finalResponse).toContain("upcoming visit details");
  });

  it("falls back safely when contradiction exists without reliable same-domain history", () => {
    const recentTurns: ConversationTurnRecord[] = [
      {
        userMessage: "When is my next appointment?",
        assistantMessage: "Based on your active profile, here are your upcoming visit details:\n- Visit encounter-1: 2099-01-01T00:00:00Z (planned).",
        domain: "appointment",
        entityReferences: ["encounter-1"],
        confidence: "low"
      }
    ];

    const result = applyResponseConsistencyGuard({
      draftResponse:
        "I checked your active profile and there are no upcoming visits listed right now. If this seems out of date, please confirm your profile or check with your care team.",
      domain: "appointment",
      entityReferences: [],
      recentTurns
    });

    expect(result.contradictionDetected).toBe(true);
    expect(result.rewriteApplied).toBe(false);
    expect(result.fallbackApplied).toBe(true);
    expect(result.finalResponse).toContain("I may be mixing details from earlier messages");
  });

  it("passes through non-contradictory responses unchanged", () => {
    const result = applyResponseConsistencyGuard({
      draftResponse: "Based on your active profile, here are your care plan tasks:\n- Annual wellness follow-up (open).",
      domain: "care-plan",
      entityReferences: ["cp1"],
      recentTurns: []
    });

    expect(result.contradictionDetected).toBe(false);
    expect(result.finalResponse).toContain("care plan tasks");
  });
});
