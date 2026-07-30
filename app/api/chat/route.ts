import type { NextRequest } from "next/server";
import { apiNotImplemented, apiSuccess } from "@/lib/api-response";
import { AppError, handleRouteError } from "@/lib/errors";
import { resolveChatRequestContext } from "@/lib/chat-request-context";
import { appendConversationTurn } from "@/lib/chat-session";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { createLogger } from "@/lib/logger";

type ChatRequestPayload = {
  conversationId: string;
  message: string;
};

async function parseChatRequestPayload(request: NextRequest): Promise<ChatRequestPayload> {
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
  const allowedKeys = new Set(["conversationId", "message"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(
        "INVALID_REQUEST_BODY",
        `Unsupported field '${key}' in chat payload.`,
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

  if (typeof payload.message !== "string" || payload.message.trim().length === 0) {
    throw new AppError("INVALID_REQUEST_BODY", "message is required and must be a non-empty string.", 400);
  }

  return {
    conversationId: payload.conversationId,
    message: payload.message.trim()
  };
}

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.chat", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

// Contract: GET /api/chat currently returns 501 until chat orchestration is implemented.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const response = apiNotImplemented("GET /api/chat");
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

// Contract: POST /api/chat validates conversation context and accepts scaffolded chat turns.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const payload = await parseChatRequestPayload(request);
    const context = resolveChatRequestContext(payload.conversationId);
    const assistantMessage =
      "Chat orchestration is scaffolded. Session and patient context propagation is active.";

    log.info("chat.request.context.resolved", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      contextSnapshotVersion: context.contextSnapshotVersion,
      sessionUpdatedAt: context.sessionUpdatedAt
    });

    const response = apiSuccess({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      contextSnapshotVersion: context.contextSnapshotVersion,
      requestAccepted: true,
      turn: {
        userMessage: payload.message,
        assistantMessage
      }
    });

    const turnCount = appendConversationTurn({
      conversationId: context.conversationId,
      userMessage: payload.message,
      assistantMessage
    });

    log.info("chat.session.turn.appended", {
      conversationId: context.conversationId,
      turnCount
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