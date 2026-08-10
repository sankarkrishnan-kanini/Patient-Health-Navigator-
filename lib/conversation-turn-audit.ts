import { AppError } from "@/lib/errors";
import { getConversationSessionById } from "@/lib/chat-session";
import { persistConversationTurnAuditRecordsSafely } from "@/lib/mysql-persistence";
import {
  createAuditValidationError,
  validateRequiredStringField,
  type AuditValidationIssue
} from "@/lib/audit-validation";

export type ConversationTurnAuditRole = "user" | "assistant";

export type ConversationTurnAuditRecord = {
  auditRecordId: string;
  conversationId: string;
  exchangeSequence: number;
  role: ConversationTurnAuditRole;
  contentReference: string;
  timestamp: string;
};

export type ConversationTurnAuditInput = {
  conversationId: string;
  userContentReference: string;
  assistantContentReference: string;
};

export type ConversationTurnAuditQuery = {
  conversationId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
};

const conversationTurnAuditStore = new Map<string, ConversationTurnAuditRecord[]>();
const conversationTurnAuditSequenceStore = new Map<string, number>();

function ensureNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw createAuditValidationError(
      "CONVERSATION_TURN_AUDIT_VALIDATION_FAILED",
      "Conversation turn audit validation failed.",
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

function validateConversationTurnAuditInput(input: ConversationTurnAuditInput): void {
  const issues: AuditValidationIssue[] = [];

  const conversationIdIssue = validateRequiredStringField(input.conversationId, "conversationId");
  if (conversationIdIssue !== null) {
    issues.push(conversationIdIssue);
  }

  const userContentReferenceIssue = validateRequiredStringField(
    input.userContentReference,
    "userContentReference"
  );
  if (userContentReferenceIssue !== null) {
    issues.push(userContentReferenceIssue);
  }

  const assistantContentReferenceIssue = validateRequiredStringField(
    input.assistantContentReference,
    "assistantContentReference"
  );
  if (assistantContentReferenceIssue !== null) {
    issues.push(assistantContentReferenceIssue);
  }

  if (issues.length > 0) {
    throw createAuditValidationError(
      "CONVERSATION_TURN_AUDIT_VALIDATION_FAILED",
      "Conversation turn audit validation failed.",
      issues
    );
  }
}

function nextExchangeSequence(conversationId: string): number {
  const nextSequence = (conversationTurnAuditSequenceStore.get(conversationId) ?? 0) + 1;
  conversationTurnAuditSequenceStore.set(conversationId, nextSequence);
  return nextSequence;
}

function createAuditRecordId(
  conversationId: string,
  exchangeSequence: number,
  role: ConversationTurnAuditRole
): string {
  return `turn_audit_${conversationId}_${exchangeSequence.toString().padStart(6, "0")}_${role}`;
}

export function appendConversationTurnAudit(
  input: ConversationTurnAuditInput
): ConversationTurnAuditRecord[] {
  validateConversationTurnAuditInput(input);
  const conversationId = ensureNonEmptyString(input.conversationId, "conversationId");
  getConversationSessionById(conversationId);

  const userContentReference = ensureNonEmptyString(
    input.userContentReference,
    "userContentReference"
  );
  const assistantContentReference = ensureNonEmptyString(
    input.assistantContentReference,
    "assistantContentReference"
  );
  const exchangeSequence = nextExchangeSequence(conversationId);
  const userTimestamp = new Date().toISOString();
  const assistantTimestamp = new Date().toISOString();

  const records: ConversationTurnAuditRecord[] = [
    {
      auditRecordId: createAuditRecordId(conversationId, exchangeSequence, "user"),
      conversationId,
      exchangeSequence,
      role: "user",
      contentReference: userContentReference,
      timestamp: userTimestamp
    },
    {
      auditRecordId: createAuditRecordId(conversationId, exchangeSequence, "assistant"),
      conversationId,
      exchangeSequence,
      role: "assistant",
      contentReference: assistantContentReference,
      timestamp: assistantTimestamp
    }
  ];

  const existingRecords = conversationTurnAuditStore.get(conversationId) ?? [];
  existingRecords.push(...records);
  conversationTurnAuditStore.set(conversationId, existingRecords);
  persistConversationTurnAuditRecordsSafely(records);
  return records;
}

export function getConversationTurnAuditEntries(conversationId: string): ConversationTurnAuditRecord[] {
  const normalizedConversationId = ensureNonEmptyString(conversationId, "conversationId");
  return [...(conversationTurnAuditStore.get(normalizedConversationId) ?? [])];
}

export function getConversationTurnAuditCount(conversationId: string): number {
  const normalizedConversationId = ensureNonEmptyString(conversationId, "conversationId");
  return (conversationTurnAuditStore.get(normalizedConversationId) ?? []).length;
}

function parseTimeFilter(value: string | undefined, fieldName: string): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new AppError(
      "CONVERSATION_TURN_AUDIT_VALIDATION_FAILED",
      `${fieldName} must be a valid ISO 8601 timestamp.`,
      400
    );
  }

  return parsed;
}

function compareAuditTurns(left: ConversationTurnAuditRecord, right: ConversationTurnAuditRecord): number {
  const timeDelta = Date.parse(left.timestamp) - Date.parse(right.timestamp);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  const sequenceDelta = left.exchangeSequence - right.exchangeSequence;
  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }

  return left.role === right.role ? 0 : left.role === "user" ? -1 : 1;
}

export function queryConversationTurnAuditEntries(
  query: ConversationTurnAuditQuery = {}
): ConversationTurnAuditRecord[] {
  const conversationId = query.conversationId?.trim();
  const startTime = parseTimeFilter(query.startTime, "startTime");
  const endTime = parseTimeFilter(query.endTime, "endTime");
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  const records = conversationId
    ? [...(conversationTurnAuditStore.get(conversationId) ?? [])]
    : Array.from(conversationTurnAuditStore.values()).flat();

  const filtered = records.filter((record) => {
    const recordedAt = Date.parse(record.timestamp);
    if (startTime !== null && recordedAt < startTime) {
      return false;
    }

    if (endTime !== null && recordedAt > endTime) {
      return false;
    }

    return true;
  });

  return filtered.sort(compareAuditTurns).slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0));
}

export function resetConversationTurnAuditStoreForTests(): void {
  conversationTurnAuditStore.clear();
  conversationTurnAuditSequenceStore.clear();
}