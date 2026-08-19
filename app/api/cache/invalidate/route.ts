import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { invalidatePatientProfileCaches } from "@/lib/cache";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.cache.invalidate", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

function readBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim() || null;
}

function isAuthorized(request: NextRequest): boolean {
  const configuredToken = process.env.CACHE_INVALIDATION_TOKEN?.trim();
  if (!configuredToken) {
    return false;
  }

  const providedToken = readBearerToken(request);
  return providedToken === configuredToken;
}

export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    if (!isAuthorized(request)) {
      const response = apiError(
        "UNAUTHORIZED",
        "Missing or invalid cache invalidation token.",
        401
      );

      log.info("api.request.completed", {
        method: request.method,
        pathname: request.nextUrl.pathname,
        statusCode: response.status
      });

      return attachCorrelationIdHeader(response, correlationId);
    }

    const result = await invalidatePatientProfileCaches();
    const response = apiSuccess({
      invalidatedPrefixes: ["profile-options", "profile-summary:"],
      ...result
    });

    log.info("cache.invalidation.completed", {
      ...result
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
