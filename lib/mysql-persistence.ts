import mysql from "mysql2/promise";

export type GuardrailAnalyticsCountRow = {
  evaluationName: string;
  triggered: boolean;
  count: number;
};

type GuardrailAnalyticsQueryRow = mysql.RowDataPacket & {
  evaluationName: string;
  triggered: number;
  count: number | string;
};

type SessionBindingLike = {
  patientId: string;
  contextSnapshotRef: string;
  contextSnapshotVersion: string;
};

type SessionMetadataLike = {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  clientProvided: boolean;
  binding: SessionBindingLike | null;
};

type TurnRecordLike = {
  userMessage: string;
  assistantMessage: string;
  domain: string;
  entityReferences: string[];
  confidence: "high" | "low";
};

type ConversationTurnAuditRecordLike = {
  auditRecordId: string;
  conversationId: string;
  exchangeSequence: number;
  role: "user" | "assistant";
  contentReference: string;
  timestamp: string;
};

type GuardrailStoredEventLike = {
  eventId: string;
  eventType: string;
  timestamp: string;
  conversationId: string;
  triggerReason: string;
  ruleId: string;
  ruleIds: string[];
  evaluationName: string;
  triggered: boolean;
  reason: string;
  sensitive: {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: string;
  };
};

let pool: mysql.Pool | null = null;

function toMySqlDateTime(value: string): string {
  return value.replace("T", " ").replace("Z", "");
}

function getPool(): mysql.Pool | null {
  if (pool) {
    return pool;
  }

  const mysqlUrl = process.env.MYSQL_URL;
  if (!mysqlUrl) {
    return null;
  }

  pool = mysql.createPool({
    uri: mysqlUrl,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
  });

  return pool;
}

function logPersistenceFailure(operation: string, error: unknown): void {
  const message = error instanceof Error ? error.message : "unknown persistence failure";
  console.error(`[mysql-persistence] ${operation} failed: ${message}`);
}

export async function persistChatSession(session: SessionMetadataLike): Promise<void> {
  const activePool = getPool();
  if (!activePool) {
    return;
  }

  await activePool.execute(
    `
      INSERT INTO chat_sessions (
        conversation_id,
        created_at,
        updated_at,
        client_provided,
        patient_id,
        context_snapshot_ref,
        context_snapshot_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        updated_at = VALUES(updated_at),
        client_provided = VALUES(client_provided),
        patient_id = VALUES(patient_id),
        context_snapshot_ref = VALUES(context_snapshot_ref),
        context_snapshot_version = VALUES(context_snapshot_version)
    `,
    [
      session.conversationId,
      toMySqlDateTime(session.createdAt),
      toMySqlDateTime(session.updatedAt),
      session.clientProvided ? 1 : 0,
      session.binding?.patientId ?? null,
      session.binding?.contextSnapshotRef ?? null,
      session.binding?.contextSnapshotVersion ?? null
    ]
  );
}

export async function persistChatTurn(
  conversationId: string,
  turnIndex: number,
  turn: TurnRecordLike
): Promise<void> {
  const activePool = getPool();
  if (!activePool) {
    return;
  }

  await activePool.execute(
    `
      INSERT INTO chat_turns (
        conversation_id,
        turn_index,
        user_message,
        assistant_message,
        domain,
        entity_references_json,
        confidence
      ) VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?)
      ON DUPLICATE KEY UPDATE
        user_message = VALUES(user_message),
        assistant_message = VALUES(assistant_message),
        domain = VALUES(domain),
        entity_references_json = VALUES(entity_references_json),
        confidence = VALUES(confidence)
    `,
    [
      conversationId,
      turnIndex,
      turn.userMessage,
      turn.assistantMessage,
      turn.domain,
      JSON.stringify(turn.entityReferences),
      turn.confidence
    ]
  );
}

export async function persistConversationTurnAuditRecords(
  records: ConversationTurnAuditRecordLike[]
): Promise<void> {
  const activePool = getPool();
  if (!activePool || records.length === 0) {
    return;
  }

  for (const record of records) {
    await activePool.execute(
      `
        INSERT INTO conversation_turn_audit (
          audit_record_id,
          conversation_id,
          exchange_sequence,
          role,
          content_reference,
          recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          content_reference = VALUES(content_reference),
          recorded_at = VALUES(recorded_at)
      `,
      [
        record.auditRecordId,
        record.conversationId,
        record.exchangeSequence,
        record.role,
        record.contentReference,
        toMySqlDateTime(record.timestamp)
      ]
    );
  }
}

export async function persistGuardrailEvent(event: GuardrailStoredEventLike): Promise<void> {
  const activePool = getPool();
  if (!activePool) {
    return;
  }

  await activePool.execute(
    `
      INSERT INTO guardrail_events (
        event_id,
        event_type,
        timestamp_utc,
        conversation_id,
        trigger_reason,
        rule_id,
        rule_ids_json,
        evaluation_name,
        triggered,
        reason,
        sensitive_ciphertext,
        sensitive_iv,
        sensitive_auth_tag,
        sensitive_key_version
      ) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        trigger_reason = VALUES(trigger_reason),
        rule_id = VALUES(rule_id),
        rule_ids_json = VALUES(rule_ids_json),
        evaluation_name = VALUES(evaluation_name),
        triggered = VALUES(triggered),
        reason = VALUES(reason),
        sensitive_ciphertext = VALUES(sensitive_ciphertext),
        sensitive_iv = VALUES(sensitive_iv),
        sensitive_auth_tag = VALUES(sensitive_auth_tag),
        sensitive_key_version = VALUES(sensitive_key_version)
    `,
    [
      event.eventId,
      event.eventType,
      toMySqlDateTime(event.timestamp),
      event.conversationId,
      event.triggerReason,
      event.ruleId,
      JSON.stringify(event.ruleIds),
      event.evaluationName,
      event.triggered ? 1 : 0,
      event.reason,
      event.sensitive.ciphertext,
      event.sensitive.iv,
      event.sensitive.authTag,
      event.sensitive.keyVersion
    ]
  );
}

export async function queryGuardrailAnalyticsCounts(): Promise<GuardrailAnalyticsCountRow[] | null> {
  const activePool = getPool();
  if (!activePool) {
    return null;
  }

  const [rows] = await activePool.query<GuardrailAnalyticsQueryRow[]>(
    `
      SELECT
        evaluation_name AS evaluationName,
        triggered,
        COUNT(*) AS count
      FROM guardrail_events
      WHERE event_type = 'guardrail_evaluation'
      GROUP BY evaluation_name, triggered
    `
  );

  return rows.map((row) => ({
    evaluationName: row.evaluationName,
    triggered: row.triggered === 1,
    count: Number(row.count)
  }));
}

export function persistChatSessionSafely(session: SessionMetadataLike): void {
  void persistChatSession(session).catch((error) => {
    logPersistenceFailure("persistChatSession", error);
  });
}

export function persistChatTurnSafely(
  conversationId: string,
  turnIndex: number,
  turn: TurnRecordLike
): void {
  void persistChatTurn(conversationId, turnIndex, turn).catch((error) => {
    logPersistenceFailure("persistChatTurn", error);
  });
}

export function persistConversationTurnAuditRecordsSafely(
  records: ConversationTurnAuditRecordLike[]
): void {
  void persistConversationTurnAuditRecords(records).catch((error) => {
    logPersistenceFailure("persistConversationTurnAuditRecords", error);
  });
}

export function persistGuardrailEventSafely(event: GuardrailStoredEventLike): void {
  void persistGuardrailEvent(event).catch((error) => {
    logPersistenceFailure("persistGuardrailEvent", error);
  });
}
