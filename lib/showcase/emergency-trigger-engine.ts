import emergencyTriggerRules from "@/lib/showcase/emergency-trigger-rules.json";

export type EmergencyTriggerRule = {
  ruleId: string;
  label: string;
  phrases: string[];
};

export type EmergencyTriggerRuleSet = {
  ruleSetVersion: string;
  rules: EmergencyTriggerRule[];
};

export type EmergencyTriggerMatch = {
  ruleId: string;
  triggerLabel: string;
  matchedExpression: string;
};

export type EmergencyTriggerResult = {
  isEmergency: boolean;
  ruleSetVersion: string;
  normalizedMessage: string;
  matches: EmergencyTriggerMatch[];
};

export const DEFAULT_EMERGENCY_TRIGGER_RULE_SET: EmergencyTriggerRuleSet =
  emergencyTriggerRules as EmergencyTriggerRuleSet;

export function normalizeEmergencyText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseMatches(normalizedMessage: string, phrase: string): boolean {
  const normalizedPhrase = normalizeEmergencyText(phrase);
  if (!normalizedPhrase) {
    return false;
  }

  const paddedMessage = ` ${normalizedMessage} `;
  const paddedPhrase = ` ${normalizedPhrase} `;
  return paddedMessage.includes(paddedPhrase);
}

export function detectEmergencyTriggers(
  message: string,
  ruleSet: EmergencyTriggerRuleSet = DEFAULT_EMERGENCY_TRIGGER_RULE_SET
): EmergencyTriggerResult {
  const normalizedMessage = normalizeEmergencyText(message);
  const matches: EmergencyTriggerMatch[] = [];

  for (const rule of ruleSet.rules) {
    for (const phrase of rule.phrases) {
      if (!phraseMatches(normalizedMessage, phrase)) {
        continue;
      }

      matches.push({
        ruleId: rule.ruleId,
        triggerLabel: rule.label,
        matchedExpression: phrase
      });
    }
  }

  return {
    isEmergency: matches.length > 0,
    ruleSetVersion: ruleSet.ruleSetVersion,
    normalizedMessage,
    matches
  };
}
