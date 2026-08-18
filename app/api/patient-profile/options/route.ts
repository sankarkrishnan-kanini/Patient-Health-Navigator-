import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { getOrSetCache } from "@/lib/cache";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";
import { listDynamicPatientOptions } from "@/lib/showcase/profile-data";

const PATIENT_OPTIONS_CACHE_TTL_SECONDS = Number.parseInt(
  process.env.PATIENT_OPTIONS_CACHE_TTL_SECONDS ?? "120",
  10
);

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.patient-profile.options", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

// Contract: GET /api/patient-profile/options returns selectable patient profile options.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const optionsCache = await getOrSetCache(
      "profile-options",
      Number.isFinite(PATIENT_OPTIONS_CACHE_TTL_SECONDS)
        ? Math.max(PATIENT_OPTIONS_CACHE_TTL_SECONDS, 1)
        : 120,
      listDynamicPatientOptions
    );
    const dynamicOptions = optionsCache.value;
    if (dynamicOptions.length === 0) {
      throw new AppError(
        "PROFILE_DATA_UNAVAILABLE",
        "No normalized patient profiles were found. Run Synthea ingestion and normalization first.",
        503
      );
    }

    const options: ShowcasePatientOption[] = dynamicOptions;

    const response = apiSuccess({ options, source: "normalized" });

    log.info("patient_profile.options.loaded", {
      optionCount: options.length,
      cacheHit: optionsCache.hit,
      cacheStore: optionsCache.store,
      source: "normalized"
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
