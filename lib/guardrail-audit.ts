import { AppError } from "@/lib/errors";

export type GuardrailActivationReason = "emergency_trigger_match";

export type GuardrailActivationEventInput = {
  conversationId: string;
  patientId: string;
  contextSnapshotRef: string;
  triggerReason: GuardrailActivationReason;
  ruleId: string;
  ruleIds: string[];
  matchedExpressions: string[];
  userTurnId: string | null;
  assistantResponseId: string | null;
};

export type GuardrailActivationEvent = GuardrailActivationEventInput & {
  eventId: string;
  eventType: "emergency_guardrail_activation";
  timestamp: string;
};

export type GuardrailActivationQuery = {
  conversationId?: string;
  ruleId?: string;
  limit?: number;
};

const guardrailEventStore: GuardrailActivationEvent[] = [];

function ensureNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AppError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      `${fieldName} is required for guardrail event persistence.`,
      500
    );
  }

  return normalized;
}

function ensureNonEmptyArray(values: string[], fieldName: string): string[] {
  if (!Array.isArray(values) || values.length === 0) {
    throw new AppError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      `${fieldName} must include at least one value for guardrail event persistence.`,
      500
    );
  }

  return values.map((value, index) => ensureNonEmptyString(value, `${fieldName}[${index}]`));
}

function nextEventId(): string {
  return `gr_evt_${new Date().toISOString()}_${(guardrailEventStore.length + 1)
    .toString()
    .padStart(6, "0")}`;
}

export function persistGuardrailActivationEvent(
  input: GuardrailActivationEventInput
): GuardrailActivationEvent {
  const ruleIds = ensureNonEmptyArray(input.ruleIds, "ruleIds");
  const event: GuardrailActivationEvent = {
    eventId: nextEventId(),
    eventType: "emergency_guardrail_activation",
    timestamp: new Date().toISOString(),
    conversationId: ensureNonEmptyString(input.conversationId, "conversationId"),
    patientId: ensureNonEmptyString(input.patientId, "patientId"),
    contextSnapshotRef: ensureNonEmptyString(input.contextSnapshotRef, "contextSnapshotRef"),
    triggerReason: input.triggerReason,
    ruleId: ensureNonEmptyString(input.ruleId, "ruleId"),
    ruleIds,
    matchedExpressions: ensureNonEmptyArray(input.matchedExpressions, "matchedExpressions"),
    userTurnId: input.userTurnId?.trim() || null,
    assistantResponseId: input.assistantResponseId?.trim() || null
  };

  if (!event.ruleIds.includes(event.ruleId)) {
    throw new AppError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      "ruleId must be included in ruleIds for guardrail event persistence.",
      500
    );
  }

  guardrailEventStore.push(event);
  return event;
}

export function queryGuardrailActivationEvents(
  query: GuardrailActivationQuery = {}
): GuardrailActivationEvent[] {
  const conversationId = query.conversationId?.trim();
  const ruleId = query.ruleId?.trim();
  const limit = query.limit ?? 100;

  const filtered = guardrailEventStore.filter((event) => {
    if (conversationId && event.conversationId !== conversationId) {
      return false;
    }

    if (ruleId && event.ruleId !== ruleId && !event.ruleIds.includes(ruleId)) {
      return false;
    }

    return true;
  });

  return filtered.slice(-Math.max(limit, 0)).reverse();
}

export function resetGuardrailActivationEventStoreForTests(): void {
  guardrailEventStore.length = 0;
}
