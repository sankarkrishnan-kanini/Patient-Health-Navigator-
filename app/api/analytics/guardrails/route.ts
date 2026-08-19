import type { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api-response";
import { queryAuditRecords } from "@/lib/audit-query";
import {
  buildGuardrailAnalytics,
  buildGuardrailAnalyticsFromCounts,
  type GuardrailEvaluationCount
} from "@/lib/guardrail-analytics";
import { queryGuardrailAnalyticsCounts } from "@/lib/mysql-persistence";
import { attachCorrelationIdHeader, getCorrelationIdFromRequest } from "@/lib/correlation-id";
import { handleRouteError } from "@/lib/errors";
import { createLogger } from "@/lib/logger";

const evaluationNames = new Set<GuardrailEvaluationCount["evaluationName"]>([
  "emergency_trigger",
  "diagnosis_boundary",
  "medication_boundary",
  "lab_interpretation_boundary",
  "post_generation_guardrail"
]);

// Contract: GET /api/analytics/guardrails returns only de-identified guardrail aggregates.
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.analytics.guardrails", correlationId });

  try {
    const persistedCounts = await queryGuardrailAnalyticsCounts();
    const validPersistedCounts = persistedCounts?.filter(
      (count): count is GuardrailEvaluationCount => evaluationNames.has(count.evaluationName as GuardrailEvaluationCount["evaluationName"])
    );
    const source = validPersistedCounts ? "mysql" : "memory";
    const analytics = validPersistedCounts
      ? buildGuardrailAnalyticsFromCounts(validPersistedCounts)
      : buildGuardrailAnalytics(
          queryAuditRecords({ limit: Number.MAX_SAFE_INTEGER }).guardrailRecords
        );
    const response = apiSuccess({ ...analytics, source });

    log.info("guardrail.analytics.queried", {
      source,
      totalEvaluations: analytics.totalEvaluations,
      flaggedEvaluations: analytics.flaggedEvaluations
    });

    return attachCorrelationIdHeader(response, correlationId);
  } catch (error) {
    return handleRouteError(error, { correlationId, log });
  }
}