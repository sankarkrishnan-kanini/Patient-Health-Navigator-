import {
  applyLabJudgmentPhraseGuard,
  buildLabInterpretationBoundary
} from "@/lib/showcase/lab-interpretation-boundary";

describe("lab interpretation boundary", () => {
  it("detects common lab interpretation query forms", () => {
    const prompts = [
      "Can you interpret my blood test?",
      "Are my lab results normal?",
      "What do my lab results mean?",
      "Is my A1C high?",
      "Are these results abnormal?"
    ];

    for (const prompt of prompts) {
      const result = buildLabInterpretationBoundary(
        prompt,
        "showcase-profile-summary:patient-401"
      );

      expect(result.isLabInterpretationIntent).toBe(true);
      expect(result.matchedRuleIds).toEqual(["LAB-BOUNDARY-001"]);
      expect(result.triggerReason).toBe("lab_interpretation_request");
    }
  });

  it("returns care-team redirection without clinical judgment wording", () => {
    const result = buildLabInterpretationBoundary(
      "What does my blood test mean?",
      "showcase-profile-summary:patient-401"
    );

    expect(result.assistantMessage).toContain("cannot interpret lab results");
    expect(result.assistantMessage).toContain("contact your care team");
    expect(result.assistantMessage?.toLowerCase()).not.toContain("normal");
    expect(result.assistantMessage?.toLowerCase()).not.toContain("abnormal");
    expect(result.assistantMessage?.toLowerCase()).not.toContain("high");
    expect(result.assistantMessage?.toLowerCase()).not.toContain("low");
  });

  it("rewrites candidate messages that contain prohibited lab judgment phrases", () => {
    const guard = applyLabJudgmentPhraseGuard(
      "Your labs are normal and not concerning.",
      {
        ruleSetVersion: "lab-judgment-phrases.v1",
        prohibitedPhrases: ["normal", "concerning"]
      }
    );

    expect(guard.correctionPath).toBe("rewrite_safe_fallback");
    expect(guard.blockedPhrases).toEqual(["normal", "concerning"]);
    expect(guard.safeMessage.toLowerCase()).not.toContain("normal");
    expect(guard.safeMessage.toLowerCase()).not.toContain("concerning");
  });

  it("does not trigger on unrelated non-lab prompts", () => {
    const result = buildLabInterpretationBoundary(
      "When is my next appointment?",
      "showcase-profile-summary:patient-401"
    );

    expect(result.isLabInterpretationIntent).toBe(false);
    expect(result.assistantMessage).toBeNull();
  });
});
