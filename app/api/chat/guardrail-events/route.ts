import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
import { queryGuardrailActivationEvents } from "@/lib/guardrail-audit";
import { createLogger } from "@/lib/logger";

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.chat.guardrail-events", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

function parseOptionalLimit(rawLimit: string | null): number | undefined {
  if (rawLimit === null) {
    return undefined;
  }

  if (!/^\d+$/.test(rawLimit)) {
    throw new AppError("INVALID_REQUEST_QUERY", "limit must be a positive integer.", 400);
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (parsed < 1) {
    throw new AppError("INVALID_REQUEST_QUERY", "limit must be greater than zero.", 400);
  }

  return parsed;
}

// Contract: GET /api/chat/guardrail-events returns persisted emergency guardrail activation events for review.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const conversationId = request.nextUrl.searchParams.get("conversationId") ?? undefined;
    const ruleId = request.nextUrl.searchParams.get("ruleId") ?? undefined;
    const limit = parseOptionalLimit(request.nextUrl.searchParams.get("limit"));

    const events = queryGuardrailActivationEvents({
      conversationId,
      ruleId,
      limit
    });

    const response = apiSuccess({
      events,
      count: events.length
    });

    log.info("chat.guardrail_activation_events.queried", {
      conversationId: conversationId ?? null,
      ruleId: ruleId ?? null,
      limit: limit ?? null,
      count: events.length
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
