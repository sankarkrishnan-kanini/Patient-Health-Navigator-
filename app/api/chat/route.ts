import type { NextRequest } from "next/server";
import { apiNotImplemented } from "@/lib/api-response";
import { requireEnv } from "@/lib/config";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

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

// Contract: POST /api/chat currently returns 501 until chat orchestration is implemented.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    requireEnv("OPENAI_API_KEY");
    const response = apiNotImplemented("POST /api/chat");
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