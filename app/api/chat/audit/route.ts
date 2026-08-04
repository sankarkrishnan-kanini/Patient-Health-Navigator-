import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { attachCorrelationIdHeader, getCorrelationIdFromRequest } from "@/lib/correlation-id";
import { AppError, handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";
import { queryAuditRecords } from "@/lib/audit-query";

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.chat.audit", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

function parseOptionalInteger(rawValue: string | null, fieldName: string): number | undefined {
  if (rawValue === null) {
    return undefined;
  }

  if (!/^-?\d+$/.test(rawValue)) {
    throw new AppError("INVALID_REQUEST_QUERY", `${fieldName} must be an integer.`, 400);
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (parsed < 0) {
    throw new AppError("INVALID_REQUEST_QUERY", `${fieldName} must be greater than or equal to zero.`, 400);
  }

  return parsed;
}

// Contract: GET /api/chat/audit returns combined turn and guardrail audit records.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const conversationId = request.nextUrl.searchParams.get("conversationId") ?? undefined;
    const startTime = request.nextUrl.searchParams.get("startTime") ?? undefined;
    const endTime = request.nextUrl.searchParams.get("endTime") ?? undefined;
    const limit = parseOptionalInteger(request.nextUrl.searchParams.get("limit"), "limit");
    const offset = parseOptionalInteger(request.nextUrl.searchParams.get("offset"), "offset");

    const audit = queryAuditRecords({
      conversationId,
      startTime,
      endTime,
      limit,
      offset
    });

    const response = apiSuccess({
      conversationId: audit.conversationId,
      timeRange: audit.timeRange,
      pagination: audit.pagination,
      records: audit.records,
      turnRecords: audit.turnRecords,
      guardrailRecords: audit.guardrailRecords
    });

    log.info("chat.audit_records.queried", {
      conversationId: audit.conversationId,
      startTime: audit.timeRange.startTime,
      endTime: audit.timeRange.endTime,
      offset: audit.pagination.offset,
      limit: audit.pagination.limit,
      returnedCount: audit.pagination.returnedCount,
      totalCount: audit.pagination.totalCount
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