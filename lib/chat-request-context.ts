import { AppError } from "@/lib/errors";
import {
  CONVERSATION_ID_REGEX,
  getConversationSessionById,
  type SessionBinding
} from "@/lib/chat-session";
import { getShowcasePatientById } from "@/lib/showcase/patient-options";

export type ChatRequestContext = {
  conversationId: string;
  patientId: string;
  contextSnapshotRef: string;
  contextSnapshotVersion: string;
  sessionUpdatedAt: string;
};

function expectedSnapshotRef(patientId: string): string {
  return `showcase-profile-summary:${patientId}`;
}

function validateBinding(binding: SessionBinding | null): asserts binding is SessionBinding {
  if (!binding) {
    throw new AppError(
      "SESSION_BINDING_MISSING",
      "Session binding is cleared. Rebind a patient context before sending chat requests.",
      409
    );
  }

  if (
    binding.patientId.trim().length === 0 ||
    binding.contextSnapshotRef.trim().length === 0 ||
    binding.contextSnapshotVersion.trim().length === 0
  ) {
    throw new AppError(
      "SESSION_BINDING_MISSING",
      "Session binding is missing required patient context fields.",
      409
    );
  }

  if (!getShowcasePatientById(binding.patientId)) {
    throw new AppError(
      "SESSION_BINDING_STALE",
      "Session binding points to a patient that is no longer available.",
      409
    );
  }

  if (binding.contextSnapshotRef !== expectedSnapshotRef(binding.patientId)) {
    throw new AppError(
      "SESSION_BINDING_STALE",
      "Session binding snapshot reference is stale for the selected patient.",
      409
    );
  }
}

export function resolveChatRequestContext(conversationId: string): ChatRequestContext {
  const normalizedConversationId = conversationId.trim();
  if (normalizedConversationId.length === 0) {
    throw new AppError("MISSING_CONVERSATION_ID", "conversationId is required for chat requests.", 400);
  }

  if (!CONVERSATION_ID_REGEX.test(normalizedConversationId)) {
    throw new AppError(
      "INVALID_CONVERSATION_ID_FORMAT",
      "conversationId has an invalid format.",
      400
    );
  }

  const session = getConversationSessionById(normalizedConversationId);
  validateBinding(session.binding);

  return {
    conversationId: session.conversationId,
    patientId: session.binding.patientId,
    contextSnapshotRef: session.binding.contextSnapshotRef,
    contextSnapshotVersion: session.binding.contextSnapshotVersion,
    sessionUpdatedAt: session.updatedAt
  };
}