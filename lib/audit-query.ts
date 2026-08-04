import {
  queryConversationTurnAuditEntries,
  type ConversationTurnAuditRecord
} from "@/lib/conversation-turn-audit";
import {
  decryptGuardrailAuditEvent,
  getGuardrailAuditStoredEvents,
  type GuardrailAuditEvent,
  type GuardrailAuditStoredEvent
} from "@/lib/guardrail-audit";

export type AuditQueryInput = {
  conversationId?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
};

export type AuditQueryRecordType = "turn" | "guardrail";

export type AuditQueryRecord =
  | {
      recordType: "turn";
      timestamp: string;
      conversationId: string;
      data: ConversationTurnAuditRecord;
    }
  | {
      recordType: "guardrail";
      timestamp: string;
      conversationId: string;
      data: GuardrailAuditEvent;
    };

export type AuditQueryResponse = {
  conversationId: string | null;
  timeRange: {
    startTime: string | null;
    endTime: string | null;
  };
  pagination: {
    offset: number;
    limit: number;
    totalCount: number;
    returnedCount: number;
    hasMore: boolean;
  };
  records: AuditQueryRecord[];
  turnRecords: ConversationTurnAuditRecord[];
  guardrailRecords: GuardrailAuditEvent[];
};

function compareByTimestamp(left: AuditQueryRecord, right: AuditQueryRecord): number {
  const timeDelta = Date.parse(left.timestamp) - Date.parse(right.timestamp);
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return left.recordType === right.recordType ? 0 : left.recordType === "turn" ? -1 : 1;
}

export function queryAuditRecords(input: AuditQueryInput = {}): AuditQueryResponse {
  const turnRecords = queryConversationTurnAuditEntries({
    conversationId: input.conversationId,
    startTime: input.startTime,
    endTime: input.endTime,
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0
  });

  const guardrailRecords = getGuardrailAuditStoredEvents()
    .filter((event) => {
      const conversationId = input.conversationId?.trim();
      if (conversationId && event.conversationId !== conversationId) {
        return false;
      }

      const recordedAt = Date.parse(event.timestamp);
      const startTime = input.startTime === undefined ? null : Date.parse(input.startTime);
      const endTime = input.endTime === undefined ? null : Date.parse(input.endTime);

      if (startTime !== null && recordedAt < startTime) {
        return false;
      }

      if (endTime !== null && recordedAt > endTime) {
        return false;
      }

      return true;
    })
    .map((event) => decryptGuardrailAuditEvent(event));

  const records: AuditQueryRecord[] = [
    ...turnRecords.map((record) => ({
      recordType: "turn" as const,
      timestamp: record.timestamp,
      conversationId: record.conversationId,
      data: record
    })),
    ...guardrailRecords.map((record) => ({
      recordType: "guardrail" as const,
      timestamp: record.timestamp,
      conversationId: record.conversationId,
      data: record
    }))
  ].sort(compareByTimestamp);

  const offset = input.offset ?? 0;
  const limit = input.limit ?? 100;
  const paginatedRecords = records.slice(Math.max(offset, 0), Math.max(offset, 0) + Math.max(limit, 0));

  return {
    conversationId: input.conversationId?.trim() ?? null,
    timeRange: {
      startTime: input.startTime?.trim() ?? null,
      endTime: input.endTime?.trim() ?? null
    },
    pagination: {
      offset,
      limit,
      totalCount: records.length,
      returnedCount: paginatedRecords.length,
      hasMore: offset + paginatedRecords.length < records.length
    },
    records: paginatedRecords,
    turnRecords: paginatedRecords.filter((record) => record.recordType === "turn").map((record) => record.data),
    guardrailRecords: paginatedRecords.filter((record) => record.recordType === "guardrail").map((record) => record.data)
  };
}

export function getAuditRecordsForConversation(conversationId: string): AuditQueryResponse {
  return queryAuditRecords({ conversationId });
}

export function getAuditRecordsInTimeRange(startTime: string, endTime: string): AuditQueryResponse {
  return queryAuditRecords({ startTime, endTime });
}