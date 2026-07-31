import { applyClarificationPrompt } from "@/lib/showcase/clarification-prompt";

describe("clarification prompt", () => {
  it("adds concise optional prompt for complex medication responses", () => {
    const result = applyClarificationPrompt({
      domain: "medication",
      responseText:
        "Based on your active profile, here are your listed medications:\n- Medication A: schedule Every morning; purpose Blood sugar management.\n- Medication B: schedule schedule not recorded; purpose purpose not recorded."
    });

    expect(result.promptAdded).toBe(true);
    expect(result.promptVariant).toContain("simpler step-by-step");
    expect(result.responseText).toContain("Want me to explain one medication");
  });

  it("adds concise optional prompt for complex condition responses", () => {
    const result = applyClarificationPrompt({
      domain: "condition",
      responseText:
        "Based on your active profile for patient-400, here are your current conditions in plain language:\n- Condition A: your active profile shows this as an ongoing health condition."
    });

    expect(result.promptAdded).toBe(true);
    expect(result.responseText).toContain("Want a shorter, plain-language explanation");
  });

  it("does not add prompt to simple responses", () => {
    const result = applyClarificationPrompt({
      domain: "general",
      responseText: "Your profile is ready."
    });

    expect(result.promptAdded).toBe(false);
    expect(result.responseText).toBe("Your profile is ready.");
  });

  it("does not append duplicate clarification prompts", () => {
    const result = applyClarificationPrompt({
      domain: "condition",
      responseText:
        "Here is a detailed condition explanation.\nWant a shorter, plain-language explanation for one condition?"
    });

    expect(result.promptAdded).toBe(false);
  });
});
