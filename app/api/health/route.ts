import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { getRuntimeConfig } from "@/lib/config";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Contract: GET /api/health returns 200 with service status and timestamp.
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.health", correlationId });

  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  try {
    const config = getRuntimeConfig();

    const response = apiSuccess({
      service: config.appName,
      environment: config.appEnv,
      status: "ok",
      timestamp: new Date().toISOString()
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