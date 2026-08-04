import { apiError } from "@/lib/api-response";
import { attachCorrelationIdHeader } from "@/lib/correlation-id";
import { safeLogContext } from "@/lib/logger";

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status = 500, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "AppError";
  }
}

type ErrorHandlerOptions = {
  correlationId: string;
  log: {
    error: (message: string, context?: Record<string, unknown>) => void;
  };
};

export function handleRouteError(error: unknown, options: ErrorHandlerOptions) {
  options.log.error(
    "api.request.failed",
    safeLogContext({
      error
    })
  );

  if (error instanceof AppError) {
    return attachCorrelationIdHeader(
      apiError(error.code, error.message, error.status, error.details),
      options.correlationId
    );
  }

  return attachCorrelationIdHeader(
    apiError("INTERNAL_ERROR", "An unexpected server error occurred.", 500),
    options.correlationId
  );
}
