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
  const log = createLogger({ source: "api.patient-profile", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

// Contract: GET /api/patient-profile currently returns 501 until profile retrieval is implemented.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const response = apiNotImplemented("GET /api/patient-profile");
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

// Contract: POST /api/patient-profile currently returns 501 until profile updates are implemented.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    requireEnv("MYSQL_URL");
    const response = apiNotImplemented("POST /api/patient-profile");
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