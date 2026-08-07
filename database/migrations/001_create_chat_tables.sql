CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_name VARCHAR(191) NOT NULL PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_sessions (
  conversation_id VARCHAR(64) NOT NULL PRIMARY KEY,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  client_provided TINYINT(1) NOT NULL,
  patient_id VARCHAR(128) NULL,
  context_snapshot_ref VARCHAR(255) NULL,
  context_snapshot_version VARCHAR(64) NULL,
  KEY idx_chat_sessions_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_turns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  turn_index INT UNSIGNED NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  domain VARCHAR(64) NOT NULL,
  entity_references_json JSON NOT NULL,
  confidence ENUM('high', 'low') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_chat_turns_session
    FOREIGN KEY (conversation_id) REFERENCES chat_sessions (conversation_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_chat_turns_conversation_turn_index UNIQUE (conversation_id, turn_index),
  KEY idx_chat_turns_conversation_id (conversation_id),
  KEY idx_chat_turns_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_turn_audit (
  audit_record_id VARCHAR(191) NOT NULL PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL,
  exchange_sequence INT UNSIGNED NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content_reference VARCHAR(191) NOT NULL,
  recorded_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_turn_audit_session
    FOREIGN KEY (conversation_id) REFERENCES chat_sessions (conversation_id)
    ON DELETE CASCADE,
  KEY idx_turn_audit_conversation_id (conversation_id),
  KEY idx_turn_audit_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS guardrail_events (
  event_id VARCHAR(191) NOT NULL PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  timestamp_utc DATETIME(3) NOT NULL,
  conversation_id VARCHAR(64) NOT NULL,
  trigger_reason VARCHAR(64) NOT NULL,
  rule_id VARCHAR(128) NOT NULL,
  rule_ids_json JSON NOT NULL,
  evaluation_name VARCHAR(128) NOT NULL,
  triggered TINYINT(1) NOT NULL,
  reason VARCHAR(191) NOT NULL,
  sensitive_ciphertext TEXT NOT NULL,
  sensitive_iv VARCHAR(191) NOT NULL,
  sensitive_auth_tag VARCHAR(191) NOT NULL,
  sensitive_key_version VARCHAR(64) NOT NULL,
  CONSTRAINT fk_guardrail_events_session
    FOREIGN KEY (conversation_id) REFERENCES chat_sessions (conversation_id)
    ON DELETE CASCADE,
  KEY idx_guardrail_events_conversation_id (conversation_id),
  KEY idx_guardrail_events_timestamp_utc (timestamp_utc),
  KEY idx_guardrail_events_rule_id (rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
