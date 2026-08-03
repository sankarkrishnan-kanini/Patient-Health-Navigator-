import {
  detectEmergencyTriggers,
  normalizeEmergencyText,
  type EmergencyTriggerRuleSet
} from "@/lib/showcase/emergency-trigger-engine";

describe("emergency trigger engine", () => {
  it("matches configured emergency phrases deterministically", () => {
    const result = detectEmergencyTriggers("I have chest pain and shortness of breath.");

    expect(result.isEmergency).toBe(true);
    expect(result.ruleSetVersion).toBe("emergency-triggers.v1");
    expect(result.matches).toEqual([
      {
        ruleId: "ER-CHEST-PAIN-001",
        triggerLabel: "chest-pain",
        matchedExpression: "chest pain"
      },
      {
        ruleId: "ER-BREATHING-001",
        triggerLabel: "breathing-difficulty",
        matchedExpression: "shortness of breath"
      }
    ]);
  });

  it("handles case and punctuation variations through normalization", () => {
    const result = detectEmergencyTriggers("CHEST-PAIN!!! and trouble breathing??");

    expect(result.isEmergency).toBe(true);
    expect(result.normalizedMessage).toBe("chest pain and trouble breathing");
    expect(result.matches).toEqual([
      {
        ruleId: "ER-CHEST-PAIN-001",
        triggerLabel: "chest-pain",
        matchedExpression: "chest pain"
      },
      {
        ruleId: "ER-BREATHING-001",
        triggerLabel: "breathing-difficulty",
        matchedExpression: "trouble breathing"
      }
    ]);
  });

  it("uses externally supplied rule sets with explicit versioning", () => {
    const customRuleSet: EmergencyTriggerRuleSet = {
      ruleSetVersion: "emergency-triggers.v2",
      rules: [
        {
          ruleId: "ER-ALT-001",
          label: "alternate-emergency",
          phrases: ["severe chest pressure"]
        }
      ]
    };

    const result = detectEmergencyTriggers("Patient reports severe chest pressure now.", customRuleSet);

    expect(result.isEmergency).toBe(true);
    expect(result.ruleSetVersion).toBe("emergency-triggers.v2");
    expect(result.matches).toEqual([
      {
        ruleId: "ER-ALT-001",
        triggerLabel: "alternate-emergency",
        matchedExpression: "severe chest pressure"
      }
    ]);
  });

  it("keeps false-negative regression prompts covered for near-miss phrasing", () => {
    const prompts = [
      "My CHEST, pain has become worse.",
      "I feel chest...pain when walking.",
      "I cannot-breathe right now.",
      "There is difficulty breathing, suddenly."
    ];

    for (const prompt of prompts) {
      const result = detectEmergencyTriggers(prompt);
      expect(result.isEmergency).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });

  it("does not match unrelated non-emergency text", () => {
    const result = detectEmergencyTriggers("Can you explain my medication schedule for today?");

    expect(result.isEmergency).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("normalizes punctuation and whitespace consistently", () => {
    expect(normalizeEmergencyText("  Chest---Pain   now!!!  ")).toBe("chest pain now");
  });
});
