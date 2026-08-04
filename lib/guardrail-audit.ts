import { AppError } from "@/lib/errors";
import {
  createAuditValidationError,
  validateRequiredBooleanField,
  validateRequiredEnumField,
  validateRequiredStringArrayField,
  validateRequiredStringField,
  type AuditValidationIssue
} from "@/lib/audit-validation";
import {
  decryptGuardrailAuditPayload,
  encryptGuardrailAuditPayload,
  type GuardrailAuditEncryptedPayload,
  type GuardrailAuditSensitivePayload
} from "@/lib/guardrail-audit-encryption";

export type GuardrailActivationReason = "emergency_trigger_match";

export type GuardrailEvaluationName =
  | "emergency_trigger"
  | "diagnosis_boundary"
  | "medication_boundary"
  | "lab_interpretation_boundary"
  | "post_generation_guardrail";

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

export type GuardrailEvaluationEventInput = {
  conversationId: string;
  patientId: string;
  contextSnapshotRef: string;
  evaluationName: GuardrailEvaluationName;
  triggered: boolean;
  reason: string;
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
  triggerReason: GuardrailActivationReason;
  encryptionKeyVersion: string;
};

export type GuardrailEvaluationEvent = GuardrailEvaluationEventInput & {
  eventId: string;
  eventType: "guardrail_evaluation";
  timestamp: string;
  encryptionKeyVersion: string;
};

export type GuardrailAuditEvent = GuardrailActivationEvent | GuardrailEvaluationEvent;

type GuardrailAuditStoredEventBase = {
  eventId: string;
  eventType: GuardrailAuditEvent["eventType"];
  timestamp: string;
  conversationId: string;
  triggerReason: string;
  ruleId: string;
  ruleIds: string[];
  evaluationName: GuardrailEvaluationName;
  triggered: boolean;
  reason: string;
  sensitive: GuardrailAuditEncryptedPayload;
};

type GuardrailAuditStoredActivationEvent = GuardrailAuditStoredEventBase & {
  eventType: GuardrailActivationEvent["eventType"];
  triggerReason: GuardrailActivationReason;
};

type GuardrailAuditStoredEvaluationEvent = GuardrailAuditStoredEventBase & {
  eventType: GuardrailEvaluationEvent["eventType"];
};

export type GuardrailAuditStoredEvent =
  | GuardrailAuditStoredActivationEvent
  | GuardrailAuditStoredEvaluationEvent;

export type GuardrailActivationQuery = {
  conversationId?: string;
  ruleId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
};

const guardrailEventStore: GuardrailAuditStoredEvent[] = [];

function ensureNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw createAuditValidationError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      "Guardrail audit validation failed.",
      [
        {
          field: fieldName,
          issue: "invalid",
          message: `${fieldName} must be a non-empty string.`
        }
      ]
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

function normalizeOptionalString(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validateGuardrailActivationInput(input: GuardrailActivationEventInput): void {
  const issues: AuditValidationIssue[] = [];

  const conversationIdIssue = validateRequiredStringField(input.conversationId, "conversationId");
  if (conversationIdIssue !== null) {
    issues.push(conversationIdIssue);
  }

  const patientIdIssue = validateRequiredStringField(input.patientId, "patientId");
  if (patientIdIssue !== null) {
    issues.push(patientIdIssue);
  }

  const contextSnapshotRefIssue = validateRequiredStringField(
    input.contextSnapshotRef,
    "contextSnapshotRef"
  );
  if (contextSnapshotRefIssue !== null) {
    issues.push(contextSnapshotRefIssue);
  }

  const triggerReasonIssue = validateRequiredEnumField(
    input.triggerReason,
    "triggerReason",
    ["emergency_trigger_match"] as const
  );
  if (triggerReasonIssue !== null) {
    issues.push(triggerReasonIssue);
  }

  const ruleIdIssue = validateRequiredStringField(input.ruleId, "ruleId");
  if (ruleIdIssue !== null) {
    issues.push(ruleIdIssue);
  }

  const ruleIdsIssue = validateRequiredStringArrayField(input.ruleIds, "ruleIds");
  if (ruleIdsIssue !== null) {
    issues.push(ruleIdsIssue);
  }

  const matchedExpressionsIssue = validateRequiredStringArrayField(
    input.matchedExpressions,
    "matchedExpressions"
  );
  if (matchedExpressionsIssue !== null) {
    issues.push(matchedExpressionsIssue);
  }

  if (issues.length > 0) {
    throw createAuditValidationError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      "Guardrail audit validation failed.",
      issues
    );
  }
}

function validateGuardrailEvaluationInput(input: GuardrailEvaluationEventInput): void {
  const issues: AuditValidationIssue[] = [];

  const conversationIdIssue = validateRequiredStringField(input.conversationId, "conversationId");
  if (conversationIdIssue !== null) {
    issues.push(conversationIdIssue);
  }

  const patientIdIssue = validateRequiredStringField(input.patientId, "patientId");
  if (patientIdIssue !== null) {
    issues.push(patientIdIssue);
  }

  const contextSnapshotRefIssue = validateRequiredStringField(
    input.contextSnapshotRef,
    "contextSnapshotRef"
  );
  if (contextSnapshotRefIssue !== null) {
    issues.push(contextSnapshotRefIssue);
  }

  const evaluationNameIssue = validateRequiredEnumField(
    input.evaluationName,
    "evaluationName",
    [
      "emergency_trigger",
      "diagnosis_boundary",
      "medication_boundary",
      "lab_interpretation_boundary",
      "post_generation_guardrail"
    ] as const
  );
  if (evaluationNameIssue !== null) {
    issues.push(evaluationNameIssue);
  }

  const triggeredIssue = validateRequiredBooleanField(input.triggered, "triggered");
  if (triggeredIssue !== null) {
    issues.push(triggeredIssue);
  }

  const reasonIssue = validateRequiredStringField(input.reason, "reason");
  if (reasonIssue !== null) {
    issues.push(reasonIssue);
  }

  const ruleIdIssue = validateRequiredStringField(input.ruleId, "ruleId");
  if (ruleIdIssue !== null) {
    issues.push(ruleIdIssue);
  }

  const ruleIdsIssue = validateRequiredStringArrayField(input.ruleIds, "ruleIds");
  if (ruleIdsIssue !== null) {
    issues.push(ruleIdsIssue);
  }

  const matchedExpressionsIssue = validateRequiredStringArrayField(
    input.matchedExpressions,
    "matchedExpressions"
  );
  if (matchedExpressionsIssue !== null) {
    issues.push(matchedExpressionsIssue);
  }

  if (issues.length > 0) {
    throw createAuditValidationError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      "Guardrail audit validation failed.",
      issues
    );
  }
}

function parseTimeFilter(value: string | undefined, fieldName: string): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new AppError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      `${fieldName} must be a valid ISO 8601 timestamp.`,
      400
    );
  }

  return parsed;
}

function createSensitivePayload(
  input: GuardrailActivationEventInput | GuardrailEvaluationEventInput
): GuardrailAuditSensitivePayload {
  return {
    patientId: input.patientId,
    contextSnapshotRef: input.contextSnapshotRef,
    matchedExpressions: input.matchedExpressions,
    userTurnId: input.userTurnId,
    assistantResponseId: input.assistantResponseId
  };
}

function createGuardrailEvaluationEvent(
  input: GuardrailEvaluationEventInput,
  eventType: GuardrailAuditEvent["eventType"] = "guardrail_evaluation"
): GuardrailAuditStoredEvent {
  return {
    eventId: nextEventId(),
    eventType,
    timestamp: new Date().toISOString(),
    conversationId: ensureNonEmptyString(input.conversationId, "conversationId"),
    evaluationName: input.evaluationName,
    triggered: input.triggered,
    reason: ensureNonEmptyString(input.reason, "reason"),
    ruleId: ensureNonEmptyString(input.ruleId, "ruleId"),
    ruleIds: ensureNonEmptyArray(input.ruleIds, "ruleIds"),
    triggerReason: input.reason,
    sensitive: encryptGuardrailAuditPayload({
      patientId: ensureNonEmptyString(input.patientId, "patientId"),
      contextSnapshotRef: ensureNonEmptyString(input.contextSnapshotRef, "contextSnapshotRef"),
      matchedExpressions: ensureNonEmptyArray(input.matchedExpressions, "matchedExpressions"),
      userTurnId: normalizeOptionalString(input.userTurnId),
      assistantResponseId: normalizeOptionalString(input.assistantResponseId)
    })
  } as GuardrailAuditStoredEvent;
}

export function persistGuardrailActivationEvent(
  input: GuardrailActivationEventInput
): GuardrailActivationEvent {
  validateGuardrailActivationInput(input);
  const storedEvent = createGuardrailEvaluationEvent(
    {
      conversationId: input.conversationId,
      patientId: input.patientId,
      contextSnapshotRef: input.contextSnapshotRef,
      evaluationName: "emergency_trigger",
      triggered: true,
      reason: input.triggerReason,
      ruleId: input.ruleId,
      ruleIds: input.ruleIds,
      matchedExpressions: input.matchedExpressions,
      userTurnId: input.userTurnId,
      assistantResponseId: input.assistantResponseId
    },
    "emergency_guardrail_activation"
  );

  const event = decryptGuardrailAuditEvent(storedEvent) as GuardrailActivationEvent;
  event.triggerReason = input.triggerReason;

  if (!storedEvent.ruleIds.includes(storedEvent.ruleId)) {
    throw new AppError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      "ruleId must be included in ruleIds for guardrail event persistence.",
      500
    );
  }

  guardrailEventStore.push({
    ...storedEvent,
    triggerReason: input.triggerReason
  });
  return event;
}

export function persistGuardrailEvaluationEvent(
  input: GuardrailEvaluationEventInput
): GuardrailEvaluationEvent {
  validateGuardrailEvaluationInput(input);
  const storedEvent = createGuardrailEvaluationEvent(input);

  if (!storedEvent.ruleIds.includes(storedEvent.ruleId)) {
    throw new AppError(
      "GUARDRAIL_AUDIT_VALIDATION_FAILED",
      "ruleId must be included in ruleIds for guardrail event persistence.",
      500
    );
  }

  guardrailEventStore.push(storedEvent);
  return decryptGuardrailAuditEvent(storedEvent) as GuardrailEvaluationEvent;
}

export function queryGuardrailActivationEvents(
  query: GuardrailActivationQuery = {}
): GuardrailAuditEvent[] {
  const conversationId = query.conversationId?.trim();
  const ruleId = query.ruleId?.trim();
  const startTime = parseTimeFilter(query.startTime, "startTime");
  const endTime = parseTimeFilter(query.endTime, "endTime");
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const filtered = guardrailEventStore.filter((event) => {
    if (conversationId && event.conversationId !== conversationId) {
      return false;
    }

    if (ruleId && event.ruleId !== ruleId && !event.ruleIds.includes(ruleId)) {
      return false;
    }

    const recordedAt = Date.parse(event.timestamp);
    if (startTime !== null && recordedAt < startTime) {
      return false;
    }

    if (endTime !== null && recordedAt > endTime) {
      return false;
    }

    return true;
  });

  return filtered
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0))
    .map((event) => decryptGuardrailAuditEvent(event));
}

export function resetGuardrailActivationEventStoreForTests(): void {
  guardrailEventStore.length = 0;
}

export function getGuardrailAuditStoredEvents(): GuardrailAuditStoredEvent[] {
  return [...guardrailEventStore];
}

export function decryptGuardrailAuditEvent(event: GuardrailAuditStoredEvent): GuardrailAuditEvent {
  const sensitive = decryptGuardrailAuditPayload(event.sensitive);

  if (event.eventType === "emergency_guardrail_activation") {
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      conversationId: event.conversationId,
      patientId: sensitive.patientId,
      contextSnapshotRef: sensitive.contextSnapshotRef,
      triggerReason: event.triggerReason,
      ruleId: event.ruleId,
      ruleIds: event.ruleIds,
      matchedExpressions: sensitive.matchedExpressions,
      userTurnId: sensitive.userTurnId,
      assistantResponseId: sensitive.assistantResponseId,
      encryptionKeyVersion: event.sensitive.keyVersion
    };
  }

  return {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    conversationId: event.conversationId,
    patientId: sensitive.patientId,
    contextSnapshotRef: sensitive.contextSnapshotRef,
    evaluationName: event.evaluationName,
    triggered: event.triggered,
    reason: event.reason,
    ruleId: event.ruleId,
    ruleIds: event.ruleIds,
    matchedExpressions: sensitive.matchedExpressions,
    userTurnId: sensitive.userTurnId,
    assistantResponseId: sensitive.assistantResponseId,
    encryptionKeyVersion: event.sensitive.keyVersion
  };
}

export function getStoredGuardrailAuditEventsForTests(): GuardrailAuditStoredEvent[] {
  return [...guardrailEventStore];
}
