import { applyPlainLanguageControls } from "@/lib/showcase/plain-language-controls";

describe("plain language controls", () => {
  it("simplifies common technical terms", () => {
    const result = applyPlainLanguageControls(
      "Chat orchestration and context propagation are active for this clinical workflow."
    );

    expect(result.responseText).toContain("workflow");
    expect(result.responseText).toContain("details");
    expect(result.responseText).toContain("passing");
    expect(result.responseText).toContain("health");
    expect(result.readability.replacementsApplied).toBeGreaterThan(0);
  });

  it("flags high jargon density after post-check", () => {
    const result = applyPlainLanguageControls(
      "Context context context context context context context context context context."
    );

    expect(result.readability.flagged).toBe(true);
    expect(result.responseText).toContain("sounds too technical");
  });

  it("shows improvement versus baseline jargon-heavy response", () => {
    const result = applyPlainLanguageControls(
      "Clinical context and diagnosis details require clinical context and diagnostic context."
    );

    expect(result.readability.baselineJargonWords).toBeGreaterThan(result.readability.finalJargonWords);
    expect(result.readability.jargonReduction).toBeGreaterThan(0);
  });

  it("keeps simple text readable without unnecessary changes", () => {
    const result = applyPlainLanguageControls("Your current profile is ready.");

    expect(result.responseText).toBe("Your current profile is ready.");
    expect(result.readability.flagged).toBe(false);
    expect(result.readability.baselineJargonWords).toBe(0);
  });
});
