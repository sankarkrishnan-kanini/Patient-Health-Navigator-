import { buildEmergencyEscalationResponse } from "@/lib/showcase/emergency-escalation-template";
import type { EmergencyTriggerMatch } from "@/lib/showcase/emergency-trigger-engine";

function chestPainMatch(): EmergencyTriggerMatch {
  return {
    ruleId: "ER-CHEST-PAIN-001",
    triggerLabel: "chest-pain",
    matchedExpression: "chest pain"
  };
}

function breathingMatch(): EmergencyTriggerMatch {
  return {
    ruleId: "ER-BREATHING-001",
    triggerLabel: "breathing-difficulty",
    matchedExpression: "trouble breathing"
  };
}

describe("emergency escalation templates", () => {
  it("selects chest-pain template deterministically", () => {
    const response = buildEmergencyEscalationResponse([chestPainMatch()]);

    expect(response.templateVersion).toBe("emergency-escalation.v1");
    expect(response.template.templateId).toBe("ESC-CHEST-PAIN-001");
    expect(response.template.escalationClass).toBe("chest-pain");
  });

  it("selects breathing-difficulty template deterministically", () => {
    const response = buildEmergencyEscalationResponse([breathingMatch()]);

    expect(response.template.templateId).toBe("ESC-BREATHING-001");
    expect(response.template.escalationClass).toBe("breathing-difficulty");
  });

  it("selects multi-symptom template when both trigger classes are matched", () => {
    const response = buildEmergencyEscalationResponse([chestPainMatch(), breathingMatch()]);

    expect(response.template.templateId).toBe("ESC-MULTI-SYMPTOM-001");
    expect(response.template.escalationClass).toBe("multi-symptom");
  });

  it("includes explicit immediate action and emergency boundary wording", () => {
    const response = buildEmergencyEscalationResponse([chestPainMatch()]);
    const message = response.assistantMessage;

    expect(message).toContain("Possible emergency symptom detected");
    expect(message).toContain("Call emergency services now");
    expect(message).toContain("immediately");
    expect(message).toContain("I cannot safely assess");
  });

  it("uses deterministic message assembly for the same trigger class", () => {
    const first = buildEmergencyEscalationResponse([breathingMatch()]);
    const second = buildEmergencyEscalationResponse([breathingMatch()]);

    expect(first.assistantMessage).toBe(second.assistantMessage);
  });
});
