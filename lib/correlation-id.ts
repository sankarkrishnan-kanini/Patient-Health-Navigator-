import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const CORRELATION_ID_HEADER = "x-correlation-id";

export function getCorrelationIdFromRequest(request: NextRequest): string {
  const incoming = request.headers.get(CORRELATION_ID_HEADER);
  if (incoming && incoming.trim().length > 0) {
    return incoming.trim();
  }

  return randomUUID();
}

export function attachCorrelationIdHeader<T>(
  response: NextResponse<T>,
  correlationId: string
): NextResponse<T> {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  return response;
}
