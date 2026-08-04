import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "@/lib/errors";

export const GUARDRAIL_AUDIT_ENCRYPTION_ALGORITHM = "aes-256-gcm";
export const DEFAULT_GUARDRAIL_AUDIT_KEY_VERSION = "demo.v1";
const DEFAULT_GUARDRAIL_AUDIT_SECRET = "patient-ai-health-navigator-demo-audit-key";

export type GuardrailAuditSensitivePayload = {
  patientId: string;
  contextSnapshotRef: string;
  matchedExpressions: string[];
  userTurnId: string | null;
  assistantResponseId: string | null;
};

export type GuardrailAuditEncryptedPayload = {
  algorithm: typeof GUARDRAIL_AUDIT_ENCRYPTION_ALGORITHM;
  keyVersion: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

function ensureNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new AppError(
      "GUARDRAIL_AUDIT_ENCRYPTION_FAILED",
      `${fieldName} must be a non-empty string for guardrail audit encryption.`,
      500
    );
  }

  return normalized;
}

function resolveKeyVersion(): string {
  return process.env.GUARDRAIL_AUDIT_KEY_VERSION?.trim() || DEFAULT_GUARDRAIL_AUDIT_KEY_VERSION;
}

function normalizeVersionId(version: string): string {
  return version.trim();
}

function envNameForVersion(version: string): string {
  return `GUARDRAIL_AUDIT_ENCRYPTION_KEY_${normalizeVersionId(version)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")}`;
}

function resolveSecretForVersion(version: string): string {
  const normalizedVersion = ensureNonEmptyString(version, "keyVersion");

  if (normalizedVersion === resolveKeyVersion()) {
    return process.env.GUARDRAIL_AUDIT_ENCRYPTION_KEY?.trim() || DEFAULT_GUARDRAIL_AUDIT_SECRET;
  }

  const rotatedSecret = process.env[envNameForVersion(normalizedVersion)]?.trim();
  if (rotatedSecret) {
    return rotatedSecret;
  }

  throw new AppError(
    "GUARDRAIL_AUDIT_DECRYPTION_FAILED",
    `No encryption key is configured for guardrail audit key version '${normalizedVersion}'.`,
    500
  );
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function serializePayload(payload: GuardrailAuditSensitivePayload): string {
  return JSON.stringify(payload);
}

function parsePayload(serialized: string): GuardrailAuditSensitivePayload {
  const parsed = JSON.parse(serialized) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError(
      "GUARDRAIL_AUDIT_DECRYPTION_FAILED",
      "Encrypted guardrail audit payload could not be parsed.",
      500
    );
  }

  const candidate = parsed as Partial<GuardrailAuditSensitivePayload>;
  if (
    typeof candidate.patientId !== "string" ||
    typeof candidate.contextSnapshotRef !== "string" ||
    !Array.isArray(candidate.matchedExpressions) ||
    (candidate.userTurnId !== null && typeof candidate.userTurnId !== "string") ||
    (candidate.assistantResponseId !== null && typeof candidate.assistantResponseId !== "string")
  ) {
    throw new AppError(
      "GUARDRAIL_AUDIT_DECRYPTION_FAILED",
      "Encrypted guardrail audit payload had an unexpected shape.",
      500
    );
  }

  return {
    patientId: candidate.patientId,
    contextSnapshotRef: candidate.contextSnapshotRef,
    matchedExpressions: candidate.matchedExpressions.filter((value): value is string => typeof value === "string"),
    userTurnId: candidate.userTurnId ?? null,
    assistantResponseId: candidate.assistantResponseId ?? null
  };
}

export function encryptGuardrailAuditPayload(
  payload: GuardrailAuditSensitivePayload,
  keyVersion = resolveKeyVersion()
): GuardrailAuditEncryptedPayload {
  const secret = resolveSecretForVersion(keyVersion);
  const key = deriveKey(secret);
  const iv = randomBytes(12);

  try {
    const cipher = createCipheriv(GUARDRAIL_AUDIT_ENCRYPTION_ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(serializePayload(payload), "utf8"),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    return {
      algorithm: GUARDRAIL_AUDIT_ENCRYPTION_ALGORITHM,
      keyVersion,
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64")
    };
  } catch (error) {
    throw new AppError(
      "GUARDRAIL_AUDIT_ENCRYPTION_FAILED",
      error instanceof Error
        ? `Failed to encrypt guardrail audit payload: ${error.message}`
        : "Failed to encrypt guardrail audit payload.",
      500
    );
  }
}

export function decryptGuardrailAuditPayload(
  encrypted: GuardrailAuditEncryptedPayload
): GuardrailAuditSensitivePayload {
  const secret = resolveSecretForVersion(encrypted.keyVersion);
  const key = deriveKey(secret);

  try {
    const decipher = createDecipheriv(
      GUARDRAIL_AUDIT_ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(encrypted.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");

    return parsePayload(plaintext);
  } catch (error) {
    throw new AppError(
      "GUARDRAIL_AUDIT_DECRYPTION_FAILED",
      error instanceof Error
        ? `Failed to decrypt guardrail audit payload: ${error.message}`
        : "Failed to decrypt guardrail audit payload.",
      500
    );
  }
}