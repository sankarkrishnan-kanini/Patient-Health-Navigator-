import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { resetConversationSession } from "@/lib/chat-session";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

type SessionResetPayload = {
  conversationId: string;
};

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.chat.session.reset", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

async function parseResetPayload(request: NextRequest): Promise<SessionResetPayload> {
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
  const allowedKeys = new Set(["conversationId"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(
        "INVALID_REQUEST_BODY",
        `Unsupported field '${key}' in session reset payload.`,
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

  return {
    conversationId: payload.conversationId
  };
}

// Contract: POST /api/chat/session/reset clears binding and turn memory for an existing session.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const payload = await parseResetPayload(request);
    const reset = resetConversationSession(payload.conversationId);
    const response = apiSuccess({
      conversationId: reset.conversationId,
      bindingCleared: reset.bindingCleared,
      clearedTurnCount: reset.clearedTurnCount,
      sessionState: reset.sessionState,
      updatedAt: reset.updatedAt
    });

    log.info("chat.session.reset", {
      conversationId: reset.conversationId,
      bindingCleared: reset.bindingCleared,
      clearedTurnCount: reset.clearedTurnCount,
      sessionState: reset.sessionState,
      updatedAt: reset.updatedAt
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