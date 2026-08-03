import { applyEmergencyMinimizationGuard } from "@/lib/showcase/emergency-minimization-guard";
import type { EmergencyEscalationTemplate } from "@/lib/showcase/emergency-escalation-template";

function safeTemplate(): EmergencyEscalationTemplate {
  return {
    templateId: "ESC-MULTI-SYMPTOM-001",
    escalationClass: "multi-symptom",
    headline: "Possible emergency symptoms detected: chest pain and breathing difficulty.",
    immediateActions: [
      "Call emergency services now.",
      "Go to the nearest emergency department immediately."
    ],
    safetyBoundary: "I cannot safely triage emergency symptoms in chat."
  };
}

describe("emergency minimization guard", () => {
  it("passes through emergency text when no minimization phrase is present", () => {
    const message =
      "Possible emergency symptoms detected: chest pain. Call emergency services now. Go to the nearest emergency department immediately.";

    const result = applyEmergencyMinimizationGuard({
      assistantMessage: message,
      template: safeTemplate()
    });

    expect(result.violationDetected).toBe(false);
    expect(result.correctionPath).toBe("none");
    expect(result.assistantMessage).toBe(message);
  });

  it("rewrites to deterministic template when minimization phrase is detected", () => {
    const result = applyEmergencyMinimizationGuard({
      assistantMessage:
        "This is probably fine, but call emergency services now. You can just monitor for now.",
      template: safeTemplate()
    });

    expect(result.violationDetected).toBe(true);
    expect(result.correctionPath).toBe("rewrite_template");
    expect(result.matchedRuleIds).toContain("MIN-002");
    expect(result.matchedRuleIds).toContain("MIN-004");
    expect(result.assistantMessage).toContain("Possible emergency symptoms detected");
    expect(result.assistantMessage).not.toContain("probably fine");
    expect(result.assistantMessage).not.toContain("just monitor");
  });

  it("hard-blocks when template rewrite would still contain minimization language", () => {
    const unsafeTemplate: EmergencyEscalationTemplate = {
      ...safeTemplate(),
      immediateActions: ["Call emergency services now.", "Wait and see if symptoms improve."]
    };

    const result = applyEmergencyMinimizationGuard({
      assistantMessage: "This is not serious. Wait and see.",
      template: unsafeTemplate
    });

    expect(result.violationDetected).toBe(true);
    expect(result.correctionPath).toBe("hard_block");
    expect(result.assistantMessage).toContain("Call emergency services now");
    expect(result.assistantMessage).not.toContain("wait and see");
    expect(result.matchedRuleIds).toContain("MIN-001");
    expect(result.matchedRuleIds).toContain("MIN-003");
  });
});
