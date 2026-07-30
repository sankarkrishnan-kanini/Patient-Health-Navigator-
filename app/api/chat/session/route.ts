import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import {
  CONVERSATION_ID_FORMAT,
  getConversationSessionById,
  startConversationSession,
  updateConversationSessionBinding
} from "@/lib/chat-session";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

type SessionStartPayload = {
  clientConversationId?: string;
  selectedPatientId: string;
};

type SessionBindingPatchPayload = {
  conversationId: string;
  selectedPatientId: string;
};

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.chat.session", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

async function parseSessionStartPayload(request: NextRequest): Promise<SessionStartPayload> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new AppError("INVALID_REQUEST_BODY", "Request body must be valid JSON.", 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("INVALID_REQUEST_BODY", "Request body must be a JSON object.", 400);
  }

  const payload = parsed as Record<string, unknown>;
  const allowedKeys = new Set(["clientConversationId", "selectedPatientId"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(
        "INVALID_REQUEST_BODY",
        `Unsupported field '${key}' in session initialization payload.`,
        400
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, "clientConversationId") &&
    typeof payload.clientConversationId !== "string"
  ) {
    throw new AppError(
      "INVALID_REQUEST_BODY",
      "clientConversationId must be a string when provided.",
      400
    );
  }

  if (typeof payload.selectedPatientId !== "string") {
    throw new AppError(
      "INVALID_REQUEST_BODY",
      "selectedPatientId is required and must be a string.",
      400
    );
  }

  return {
    clientConversationId: payload.clientConversationId as string | undefined,
    selectedPatientId: payload.selectedPatientId
  };
}

async function parseSessionBindingPatchPayload(
  request: NextRequest
): Promise<SessionBindingPatchPayload> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new AppError("INVALID_REQUEST_BODY", "Request body must be valid JSON.", 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("INVALID_REQUEST_BODY", "Request body must be a JSON object.", 400);
  }

  const payload = parsed as Record<string, unknown>;
  const allowedKeys = new Set(["conversationId", "selectedPatientId"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(
        "INVALID_REQUEST_BODY",
        `Unsupported field '${key}' in session binding payload.`,
        400
      );
    }
  }

  if (typeof payload.conversationId !== "string") {
    throw new AppError(
      "INVALID_REQUEST_BODY",
      "conversationId is required and must be a string.",
      400
    );
  }

  if (typeof payload.selectedPatientId !== "string") {
    throw new AppError(
      "INVALID_REQUEST_BODY",
      "selectedPatientId is required and must be a string.",
      400
    );
  }

  return {
    conversationId: payload.conversationId,
    selectedPatientId: payload.selectedPatientId
  };
}

// Contract: GET /api/chat/session?conversationId=<id> returns current patient binding for the session.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const conversationId = request.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      throw new AppError(
        "INVALID_REQUEST_QUERY",
        "conversationId query parameter is required.",
        400
      );
    }

    const session = getConversationSessionById(conversationId);
    const response = apiSuccess({
      conversationId: session.conversationId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      binding: session.binding
    });

    log.info("chat.session.binding.read", {
      conversationId: session.conversationId,
      patientId: session.binding?.patientId ?? null,
      contextSnapshotRef: session.binding?.contextSnapshotRef ?? null,
      contextSnapshotVersion: session.binding?.contextSnapshotVersion ?? null
    });

    log.info("api.request.completed", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      statusCode: response.status
    });

    return attachCorrelationIdHeader(response, correlationId);
  } catch (error) {
    return handleRouteError(error, { correlationId, log });
  }
}

// Contract: POST /api/chat/session starts a new conversation session and returns a unique conversation ID.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const payload = await parseSessionStartPayload(request);
    const session = startConversationSession(payload);
    const response = apiSuccess(
      {
        conversationId: session.conversationId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        clientProvided: session.clientProvided,
        binding: session.binding,
        idFormat: CONVERSATION_ID_FORMAT
      },
      201
    );

    log.info("chat.session.started", {
      conversationId: session.conversationId,
      clientProvided: session.clientProvided,
      createdAt: session.createdAt,
      patientId: session.binding.patientId,
      contextSnapshotRef: session.binding.contextSnapshotRef,
      contextSnapshotVersion: session.binding.contextSnapshotVersion
    });

    log.info("api.request.completed", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      statusCode: response.status
    });

    return attachCorrelationIdHeader(response, correlationId);
  } catch (error) {
    return handleRouteError(error, { correlationId, log });
  }
}

// Contract: PATCH /api/chat/session updates patient binding for an existing conversation session.
export async function PATCH(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const payload = await parseSessionBindingPatchPayload(request);
    const session = updateConversationSessionBinding(payload);
    const response = apiSuccess({
      conversationId: session.conversationId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      binding: session.binding
    });

    log.info("chat.session.binding.updated", {
      conversationId: session.conversationId,
      patientId: session.binding.patientId,
      contextSnapshotRef: session.binding.contextSnapshotRef,
      contextSnapshotVersion: session.binding.contextSnapshotVersion
    });

    log.info("api.request.completed", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      statusCode: response.status
    });

    return attachCorrelationIdHeader(response, correlationId);
  } catch (error) {
    return handleRouteError(error, { correlationId, log });
  }
}