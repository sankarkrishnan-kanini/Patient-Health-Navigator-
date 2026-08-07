import type { NextRequest } from "next/server";
import { apiNotImplemented, apiSuccess } from "@/lib/api-response";
import { fetchShowcaseProfileSummary } from "@/lib/showcase/profile-summary";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
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

// Contract: GET /api/patient-profile?profileId=<id> returns patient profile summary for the selected profile.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const profileId = request.nextUrl.searchParams.get("profileId")?.trim();
    if (!profileId) {
      throw new AppError(
        "INVALID_REQUEST_QUERY",
        "profileId query parameter is required.",
        400
      );
    }

    const summary = await fetchShowcaseProfileSummary(profileId, { delayMs: 0 });
    if (!summary) {
      throw new AppError("PROFILE_NOT_FOUND", "Patient profile was not found.", 404);
    }

    const response = apiSuccess({ summary });

    log.info("patient_profile.summary.loaded", {
      profileId,
      conditionCount: summary.activeConditions.length,
      medicationCount: summary.activeMedications.length,
      careTaskCount: summary.careTasks.length,
      visitCount: summary.upcomingVisits.length
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

// Contract: POST /api/patient-profile currently returns 501 until profile updates are implemented.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
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