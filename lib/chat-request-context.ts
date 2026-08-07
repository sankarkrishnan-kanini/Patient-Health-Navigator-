import { AppError } from "@/lib/errors";
import {
  CONVERSATION_ID_REGEX,
  getConversationSessionById,
  type SessionBinding
} from "@/lib/chat-session";
import { fetchDynamicProfileSummary } from "@/lib/showcase/profile-data";

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

async function validateBinding(binding: SessionBinding | null): Promise<SessionBinding> {
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

  const profile = await fetchDynamicProfileSummary(binding.patientId);
  if (!profile) {
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

  return binding;
}

export async function resolveChatRequestContext(conversationId: string): Promise<ChatRequestContext> {
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
  const binding = await validateBinding(session.binding);

  return {
    conversationId: session.conversationId,
    patientId: binding.patientId,
    contextSnapshotRef: binding.contextSnapshotRef,
    contextSnapshotVersion: binding.contextSnapshotVersion,
    sessionUpdatedAt: session.updatedAt
  };
}