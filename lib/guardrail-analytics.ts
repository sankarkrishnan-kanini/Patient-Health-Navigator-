import type { GuardrailAuditEvent, GuardrailEvaluationName } from "@/lib/guardrail-audit";

export type GuardrailRiskCategory = "critical" | "medication" | "normal";

export type GuardrailAnalytics = {
  totalEvaluations: number;
  flaggedEvaluations: number;
  categories: Record<GuardrailRiskCategory, number>;
  ruleFamilies: Array<{
    evaluationName: GuardrailEvaluationName;
    total: number;
    triggered: number;
  }>;
};

export type GuardrailEvaluationCount = {
  evaluationName: GuardrailEvaluationName;
  triggered: boolean;
  count: number;
};

const evaluationNames: GuardrailEvaluationName[] = [
  "emergency_trigger",
  "medication_boundary",
  "diagnosis_boundary",
  "lab_interpretation_boundary",
  "post_generation_guardrail"
];

function createCategoryCounts(): Record<GuardrailRiskCategory, number> {
  return { critical: 0, medication: 0, normal: 0 };
}

export function getGuardrailRiskCategory(event: GuardrailAuditEvent): GuardrailRiskCategory | null {
  if (event.eventType === "emergency_guardrail_activation") {
    return null;
  }

  if (event.evaluationName === "emergency_trigger" && event.triggered) {
    return "critical";
  }

  if (event.evaluationName === "medication_boundary" && event.triggered) {
    return "medication";
  }

  return "normal";
}

export function buildGuardrailAnalytics(events: GuardrailAuditEvent[]): GuardrailAnalytics {
  const counts: GuardrailEvaluationCount[] = [];

  for (const event of events) {
    if (event.eventType !== "guardrail_evaluation") {
      continue;
    }

    const existing = counts.find(
      (count) =>
        count.evaluationName === event.evaluationName && count.triggered === event.triggered
    );
    if (existing) {
      existing.count += 1;
    } else {
      counts.push({
        evaluationName: event.evaluationName,
        triggered: event.triggered,
        count: 1
      });
    }
  }

  return buildGuardrailAnalyticsFromCounts(counts);
}

export function buildGuardrailAnalyticsFromCounts(
  counts: GuardrailEvaluationCount[]
): GuardrailAnalytics {
  const categories = createCategoryCounts();
  const ruleFamilies = evaluationNames.map((evaluationName) => ({
    evaluationName,
    total: 0,
    triggered: 0
  }));
  const ruleFamilyByName = new Map(ruleFamilies.map((family) => [family.evaluationName, family]));

  for (const count of counts) {
    const category =
      count.evaluationName === "emergency_trigger" && count.triggered
        ? "critical"
        : count.evaluationName === "medication_boundary" && count.triggered
          ? "medication"
          : "normal";

    categories[category] += count.count;
    const family = ruleFamilyByName.get(count.evaluationName);
    if (family) {
      family.total += count.count;
      if (count.triggered) {
        family.triggered += count.count;
      }
    }
  }

  const totalEvaluations = Object.values(categories).reduce((total, count) => total + count, 0);

  return {
    totalEvaluations,
    flaggedEvaluations: categories.critical + categories.medication,
    categories,
    ruleFamilies
  };
}