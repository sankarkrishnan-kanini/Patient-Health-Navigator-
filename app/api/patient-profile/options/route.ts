import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";
import { listDynamicPatientOptions } from "@/lib/showcase/profile-data";

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
    const dynamicOptions = await listDynamicPatientOptions();
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
