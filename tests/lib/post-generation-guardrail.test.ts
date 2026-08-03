import { applyPostGenerationGuardrail } from "@/lib/showcase/post-generation-guardrail";

describe("post-generation guardrail", () => {
  it("overrides diagnosis-violating draft responses", () => {
    const result = applyPostGenerationGuardrail("You have diabetes based on your symptoms.");

    expect(result.overrideApplied).toBe(true);
    expect(result.violationCategory).toBe("diagnosis");
    expect(result.overrideReason).toBe("prohibited_advice_detected");
    expect(result.matchedRuleIds).toEqual(["PG-DIAGNOSIS-001"]);
    expect(result.finalResponse).toContain("cannot diagnose conditions");
  });

  it("overrides medication-violating draft responses", () => {
    const result = applyPostGenerationGuardrail("You should increase your dose and stop taking Medication A.");

    expect(result.overrideApplied).toBe(true);
    expect(result.violationCategory).toBe("medication");
    expect(result.matchedRuleIds).toEqual(["PG-MEDICATION-001"]);
    expect(result.finalResponse).toContain("cannot provide medication dose changes");
  });

  it("overrides lab-judgment violating draft responses", () => {
    const result = applyPostGenerationGuardrail("Your lab results are normal and in a safe range.");

    expect(result.overrideApplied).toBe(true);
    expect(result.violationCategory).toBe("lab");
    expect(result.matchedRuleIds).toEqual(["PG-LAB-001"]);
    expect(result.finalResponse).toContain("cannot interpret lab results");
  });

  it("passes through non-violating draft responses", () => {
    const draft = "Based on your profile, here are your listed care plan tasks.";
    const result = applyPostGenerationGuardrail(draft);

    expect(result.overrideApplied).toBe(false);
    expect(result.violationCategory).toBeNull();
    expect(result.matchedRuleIds).toEqual([]);
    expect(result.finalResponse).toBe(draft);
  });
});
