import type { EmergencyTriggerMatch } from "@/lib/showcase/emergency-trigger-engine";

export type EmergencyEscalationClass =
  | "chest-pain"
  | "breathing-difficulty"
  | "multi-symptom";

export type EmergencyEscalationTemplate = {
  templateId: string;
  escalationClass: EmergencyEscalationClass;
  headline: string;
  immediateActions: string[];
  safetyBoundary: string;
};

export type EmergencyEscalationResponse = {
  templateVersion: string;
  template: EmergencyEscalationTemplate;
  assistantMessage: string;
};

export const EMERGENCY_ESCALATION_TEMPLATE_VERSION = "emergency-escalation.v1";

const ESCALATION_TEMPLATES: Record<EmergencyEscalationClass, EmergencyEscalationTemplate> = {
  "chest-pain": {
    templateId: "ESC-CHEST-PAIN-001",
    escalationClass: "chest-pain",
    headline: "Possible emergency symptom detected: chest pain.",
    immediateActions: [
      "Call emergency services now.",
      "Go to the nearest emergency department immediately."
    ],
    safetyBoundary: "I cannot safely assess emergency chest pain in chat."
  },
  "breathing-difficulty": {
    templateId: "ESC-BREATHING-001",
    escalationClass: "breathing-difficulty",
    headline: "Possible emergency symptom detected: breathing difficulty.",
    immediateActions: [
      "Call emergency services now.",
      "Seek immediate in-person emergency care."
    ],
    safetyBoundary: "I cannot safely assess emergency breathing problems in chat."
  },
  "multi-symptom": {
    templateId: "ESC-MULTI-SYMPTOM-001",
    escalationClass: "multi-symptom",
    headline: "Possible emergency symptoms detected: chest pain and breathing difficulty.",
    immediateActions: [
      "Call emergency services now.",
      "Go to the nearest emergency department immediately."
    ],
    safetyBoundary: "I cannot safely triage emergency symptoms in chat."
  }
};

function resolveEscalationClass(matches: EmergencyTriggerMatch[]): EmergencyEscalationClass {
  const labels = new Set(matches.map((match) => match.triggerLabel));
  if (labels.has("chest-pain") && labels.has("breathing-difficulty")) {
    return "multi-symptom";
  }

  if (labels.has("chest-pain")) {
    return "chest-pain";
  }

  return "breathing-difficulty";
}

function buildAssistantMessage(template: EmergencyEscalationTemplate): string {
  return [template.headline, ...template.immediateActions, template.safetyBoundary].join(" ");
}

export function buildEmergencyEscalationResponse(
  matches: EmergencyTriggerMatch[]
): EmergencyEscalationResponse {
  const escalationClass = resolveEscalationClass(matches);
  const template = ESCALATION_TEMPLATES[escalationClass];

  return {
    templateVersion: EMERGENCY_ESCALATION_TEMPLATE_VERSION,
    template,
    assistantMessage: buildAssistantMessage(template)
  };
}
