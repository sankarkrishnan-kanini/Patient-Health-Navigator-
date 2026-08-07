import { randomBytes } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/errors";

export const CONVERSATION_ID_FORMAT = "conv_<YYYYMMDDTHHMMSSZ>_<12hex>";
export const CONVERSATION_ID_REGEX = /^conv_\d{8}T\d{6}Z_[a-f0-9]{12}$/;
export const CONTEXT_SNAPSHOT_VERSION = "showcase.v1";

export type SessionStartInput = {
  clientConversationId?: string;
  selectedPatientId: string;
};

export type SessionBinding = {
  patientId: string;
  contextSnapshotRef: string;
  contextSnapshotVersion: string;
};

export type ConversationSessionMetadata = {
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  clientProvided: boolean;
  binding: SessionBinding | null;
};

export type SessionBindingUpdateInput = {
  conversationId: string;
  selectedPatientId: string;
};

export type SessionTurnAppendInput = {
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  memoryContext?: ConversationTurnMemoryContext;
};

export type ConversationTurnMemoryContext = {
  domain:
    | "medication"
    | "condition"
    | "appointment"
    | "care-plan"
    | "lifestyle"
    | "diagnosis-boundary"
    | "medication-boundary"
    | "lab-boundary"
    | "emergency"
    | "general";
  entityReferences: string[];
  confidence: "high" | "low";
};

export type ConversationTurnRecord = {
  userMessage: string;
  assistantMessage: string;
  domain: ConversationTurnMemoryContext["domain"];
  entityReferences: string[];
  confidence: ConversationTurnMemoryContext["confidence"];
};

export type SessionResetResult = {
  conversationId: string;
  bindingCleared: boolean;
  clearedTurnCount: number;
  sessionState: "ready_for_rebind";
  updatedAt: string;
};

const MAX_GENERATION_ATTEMPTS = 8;
export const DEFAULT_TURN_MEMORY_WINDOW = 10;
const sessionStore = new Map<string, ConversationSessionMetadata>();
const turnMemoryStore = new Map<string, ConversationTurnRecord[]>();

function readDynamicPatientIdsFromNormalizedStore(): Set<string> {
  const patientIds = new Set<string>();
  const normalizedRoot = path.join(
    process.cwd(),
    ".propel",
    "context",
    "data",
    "normalized",
    "patient-context"
  );

  let latestPatientsDirectory: string | null = null;
  let latestTimestamp = -1;

  try {
    const runEntries = readdirSync(normalizedRoot, { withFileTypes: true });
    for (const runEntry of runEntries) {
      if (!runEntry.isDirectory()) {
        continue;
      }

      const patientsDirectory = path.join(normalizedRoot, runEntry.name, "patients");
      const stats = statSync(patientsDirectory, { throwIfNoEntry: false });
      if (!stats || !stats.isDirectory()) {
        continue;
      }

      if (stats.mtimeMs > latestTimestamp) {
        latestTimestamp = stats.mtimeMs;
        latestPatientsDirectory = patientsDirectory;
      }
    }

    if (!latestPatientsDirectory) {
      return patientIds;
    }

    const patientFiles = readdirSync(latestPatientsDirectory, { withFileTypes: true });
    for (const patientFile of patientFiles) {
      if (!patientFile.isFile() || !patientFile.name.toLowerCase().endsWith(".json")) {
        continue;
      }

      patientIds.add(patientFile.name.slice(0, -5));
    }
  } catch {
    return patientIds;
  }

  return patientIds;
}

function ensureNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new AppError("INVALID_SESSION_BINDING", `${fieldName} must be a non-empty string.`, 400);
  }

  return normalized;
}

function assertPatientExists(patientId: string): void {
  const dynamicPatientIds = readDynamicPatientIdsFromNormalizedStore();
  if (dynamicPatientIds.has(patientId)) {
    return;
  }

  throw new AppError(
    "INVALID_PATIENT_ID",
    `selectedPatientId '${patientId}' is not available in the showcase dataset.`,
    400
  );
}

function createBindingFromPatient(patientId: string): SessionBinding {
  return {
    patientId,
    contextSnapshotRef: `showcase-profile-summary:${patientId}`,
    contextSnapshotVersion: CONTEXT_SNAPSHOT_VERSION
  };
}

function toTimestampIdFragment(now: Date): string {
  const year = now.getUTCFullYear().toString().padStart(4, "0");
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = now.getUTCDate().toString().padStart(2, "0");
  const hour = now.getUTCHours().toString().padStart(2, "0");
  const minute = now.getUTCMinutes().toString().padStart(2, "0");
  const second = now.getUTCSeconds().toString().padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function createGeneratedConversationId(now = new Date()): string {
  const timestamp = toTimestampIdFragment(now);
  const suffix = randomBytes(6).toString("hex");
  return `conv_${timestamp}_${suffix}`;
}

function validateClientConversationId(clientConversationId: string): void {
  if (!CONVERSATION_ID_REGEX.test(clientConversationId)) {
    throw new AppError(
      "INVALID_SESSION_ID_FORMAT",
      `clientConversationId must match '${CONVERSATION_ID_FORMAT}'.`,
      400
    );
  }
}

function assertSessionIdNotReused(conversationId: string): void {
  if (sessionStore.has(conversationId)) {
    throw new AppError(
      "SESSION_ID_REUSED",
      "The provided conversation ID has already been used.",
      409
    );
  }
}

function persistSession(
  conversationId: string,
  clientProvided: boolean,
  binding: SessionBinding
): ConversationSessionMetadata {
  const now = new Date().toISOString();
  const metadata: ConversationSessionMetadata = {
    conversationId,
    createdAt: now,
    updatedAt: now,
    clientProvided,
    binding
  };

  sessionStore.set(conversationId, metadata);
  return metadata;
}

function generateUniqueConversationId(): string {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const candidate = createGeneratedConversationId();
    if (!sessionStore.has(candidate)) {
      return candidate;
    }
  }

  throw new AppError(
    "SESSION_ID_GENERATION_FAILED",
    "Unable to generate a unique conversation ID at this time.",
    500
  );
}

export function startConversationSession(input: SessionStartInput): ConversationSessionMetadata {
  const selectedPatientId = ensureNonEmptyString(input.selectedPatientId, "selectedPatientId");
  assertPatientExists(selectedPatientId);
  const binding = createBindingFromPatient(selectedPatientId);

  if (input.clientConversationId) {
    const clientConversationId = ensureNonEmptyString(input.clientConversationId, "clientConversationId");
    validateClientConversationId(clientConversationId);
    assertSessionIdNotReused(clientConversationId);
    return persistSession(clientConversationId, true, binding);
  }

  const conversationId = generateUniqueConversationId();
  return persistSession(conversationId, false, binding);
}

export function getConversationSessionById(conversationId: string): ConversationSessionMetadata {
  const normalizedConversationId = ensureNonEmptyString(conversationId, "conversationId");
  const session = sessionStore.get(normalizedConversationId);

  if (!session) {
    throw new AppError("SESSION_NOT_FOUND", "Conversation session was not found.", 404);
  }

  return session;
}

export function updateConversationSessionBinding(
  input: SessionBindingUpdateInput
): ConversationSessionMetadata {
  const normalizedConversationId = ensureNonEmptyString(input.conversationId, "conversationId");
  const selectedPatientId = ensureNonEmptyString(input.selectedPatientId, "selectedPatientId");
  assertPatientExists(selectedPatientId);

  const session = getConversationSessionById(normalizedConversationId);
  const updated: ConversationSessionMetadata = {
    ...session,
    updatedAt: new Date().toISOString(),
    binding: createBindingFromPatient(selectedPatientId)
  };

  sessionStore.set(normalizedConversationId, updated);
  return updated;
}

export function appendConversationTurn(input: SessionTurnAppendInput): number {
  const normalizedConversationId = ensureNonEmptyString(input.conversationId, "conversationId");
  const userMessage = ensureNonEmptyString(input.userMessage, "userMessage");
  const assistantMessage = ensureNonEmptyString(input.assistantMessage, "assistantMessage");
  const session = getConversationSessionById(normalizedConversationId);

  if (!session.binding) {
    throw new AppError(
      "SESSION_BINDING_MISSING",
      "Cannot append turn memory when session patient binding is cleared.",
      409
    );
  }

  const turns = turnMemoryStore.get(normalizedConversationId) ?? [];
  turns.push({
    userMessage,
    assistantMessage,
    domain: input.memoryContext?.domain ?? "general",
    entityReferences: input.memoryContext?.entityReferences ?? [],
    confidence: input.memoryContext?.confidence ?? "high"
  });
  turnMemoryStore.set(normalizedConversationId, turns);
  return turns.length;
}

export function getConversationTurnCount(conversationId: string): number {
  const normalizedConversationId = ensureNonEmptyString(conversationId, "conversationId");
  return (turnMemoryStore.get(normalizedConversationId) ?? []).length;
}

export function getRecentConversationTurns(
  conversationId: string,
  limit = DEFAULT_TURN_MEMORY_WINDOW
): ConversationTurnRecord[] {
  const normalizedConversationId = ensureNonEmptyString(conversationId, "conversationId");
  const turns = turnMemoryStore.get(normalizedConversationId) ?? [];
  return turns.slice(-Math.max(limit, 0));
}

export function resetConversationSession(conversationId: string): SessionResetResult {
  const normalizedConversationId = ensureNonEmptyString(conversationId, "conversationId");
  const session = getConversationSessionById(normalizedConversationId);
  const turns = turnMemoryStore.get(normalizedConversationId) ?? [];
  const clearedTurnCount = turns.length;

  turnMemoryStore.delete(normalizedConversationId);

  const updatedAt = new Date().toISOString();
  const updatedSession: ConversationSessionMetadata = {
    ...session,
    updatedAt,
    binding: null
  };

  sessionStore.set(normalizedConversationId, updatedSession);

  return {
    conversationId: normalizedConversationId,
    bindingCleared: session.binding !== null,
    clearedTurnCount,
    sessionState: "ready_for_rebind",
    updatedAt
  };
}

export function resetConversationSessionStoreForTests(): void {
  sessionStore.clear();
  turnMemoryStore.clear();
}