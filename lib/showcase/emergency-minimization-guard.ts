import minimizationRules from "@/lib/showcase/emergency-minimization-rules.json";
import type { EmergencyEscalationTemplate } from "@/lib/showcase/emergency-escalation-template";

export type MinimizationPhraseRule = {
  ruleId: string;
  phrase: string;
};

export type MinimizationRuleSet = {
  ruleSetVersion: string;
  rules: MinimizationPhraseRule[];
};

export type MinimizationGuardInput = {
  assistantMessage: string;
  template: EmergencyEscalationTemplate;
};

export type MinimizationGuardResult = {
  assistantMessage: string;
  ruleSetVersion: string;
  violationDetected: boolean;
  correctionPath: "none" | "rewrite_template" | "hard_block";
  matchedRuleIds: string[];
  matchedPhrases: string[];
};

export const DEFAULT_MINIMIZATION_RULE_SET: MinimizationRuleSet =
  minimizationRules as MinimizationRuleSet;

const HARD_BLOCK_ESCALATION_MESSAGE = [
  "Possible emergency symptom detected.",
  "Call emergency services now.",
  "Go to the nearest emergency department immediately.",
  "I cannot safely triage emergency symptoms in chat."
].join(" ");

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTemplateMessage(template: EmergencyEscalationTemplate): string {
  return [template.headline, ...template.immediateActions, template.safetyBoundary].join(" ");
}

function detectMinimizationRules(message: string, ruleSet: MinimizationRuleSet): MinimizationPhraseRule[] {
  const normalizedMessage = normalizeText(message);
  const paddedMessage = ` ${normalizedMessage} `;

  return ruleSet.rules.filter((rule) => {
    const phrase = normalizeText(rule.phrase);
    if (!phrase) {
      return false;
    }

    return paddedMessage.includes(` ${phrase} `);
  });
}

export function applyEmergencyMinimizationGuard(
  input: MinimizationGuardInput,
  ruleSet: MinimizationRuleSet = DEFAULT_MINIMIZATION_RULE_SET
): MinimizationGuardResult {
  const violationsInDraft = detectMinimizationRules(input.assistantMessage, ruleSet);
  if (violationsInDraft.length === 0) {
    return {
      assistantMessage: input.assistantMessage,
      ruleSetVersion: ruleSet.ruleSetVersion,
      violationDetected: false,
      correctionPath: "none",
      matchedRuleIds: [],
      matchedPhrases: []
    };
  }

  const templateRewrittenMessage = buildTemplateMessage(input.template);
  const violationsInRewrite = detectMinimizationRules(templateRewrittenMessage, ruleSet);

  if (violationsInRewrite.length === 0) {
    return {
      assistantMessage: templateRewrittenMessage,
      ruleSetVersion: ruleSet.ruleSetVersion,
      violationDetected: true,
      correctionPath: "rewrite_template",
      matchedRuleIds: violationsInDraft.map((rule) => rule.ruleId),
      matchedPhrases: violationsInDraft.map((rule) => rule.phrase)
    };
  }

  const hardBlockViolations = detectMinimizationRules(HARD_BLOCK_ESCALATION_MESSAGE, ruleSet);
  return {
    assistantMessage: hardBlockViolations.length === 0 ? HARD_BLOCK_ESCALATION_MESSAGE : "Call emergency services now.",
    ruleSetVersion: ruleSet.ruleSetVersion,
    violationDetected: true,
    correctionPath: "hard_block",
    matchedRuleIds: violationsInDraft.map((rule) => rule.ruleId),
    matchedPhrases: violationsInDraft.map((rule) => rule.phrase)
  };
}
