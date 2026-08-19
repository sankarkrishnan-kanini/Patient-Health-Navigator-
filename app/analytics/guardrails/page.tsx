"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GuardrailAnalytics } from "@/lib/guardrail-analytics";

type AnalyticsResponse = GuardrailAnalytics & { source: "mysql" | "memory" };

const categoryDetails = {
  critical: {
    label: "Critical risk",
    description: "Life-threatening or emergency escalation prompts."
  },
  medication: {
    label: "Dose and consumption",
    description: "Medication dose, stop/switch, or schedule requests."
  },
  normal: {
    label: "Routine review",
    description: "Prompts evaluated without a critical or medication flag."
  }
} as const;

function formatFamilyName(name: string): string {
  return name.replaceAll("_", " ");
}

export default function GuardrailAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const response = await fetch("/api/analytics/guardrails", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load guardrail analytics.");
        }

        const body: { success: boolean; data?: AnalyticsResponse } = await response.json();
        if (!body.success || !body.data) {
          throw new Error("Could not load guardrail analytics.");
        }

        setAnalytics(body.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load guardrail analytics.");
      }
    }

    void loadAnalytics();
  }, []);

  return (
    <main className="analytics-page">
      <header className="analytics-header">
        <div>
          <Link className="analytics-back-link" href="/">Overview</Link>
          <p className="analytics-eyebrow">Safety operations</p>
          <h1>Guardrail Analytics</h1>
          <p className="analytics-intro">De-identified prompt classification across safety guardrails.</p>
        </div>
        {analytics && <span className="analytics-source">Source: {analytics.source === "mysql" ? "MySQL" : "In-memory"}</span>}
      </header>

      {error && <p className="analytics-error" role="alert">{error}</p>}

      {!analytics && !error && <p className="analytics-loading">Loading safety events...</p>}

      {analytics && (
        <>
          <section className="analytics-kpis" aria-label="Guardrail overview">
            <article className="analytics-kpi">
              <span>Total evaluations</span>
              <strong>{analytics.totalEvaluations}</strong>
            </article>
            <article className="analytics-kpi analytics-kpi-flagged">
              <span>Flagged prompts</span>
              <strong>{analytics.flaggedEvaluations}</strong>
            </article>
            <article className="analytics-kpi">
              <span>Flag rate</span>
              <strong>{analytics.totalEvaluations ? Math.round((analytics.flaggedEvaluations / analytics.totalEvaluations) * 100) : 0}%</strong>
            </article>
          </section>

          <section className="analytics-categories" aria-label="Prompt risk categories">
            {(Object.keys(categoryDetails) as Array<keyof typeof categoryDetails>).map((category) => (
              <article className={`analytics-category analytics-category-${category}`} key={category}>
                <p>{categoryDetails[category].label}</p>
                <strong>{analytics.categories[category]}</strong>
                <span>{categoryDetails[category].description}</span>
              </article>
            ))}
          </section>

          <section className="analytics-table-section" aria-labelledby="rule-families-title">
            <div>
              <p className="analytics-eyebrow">Coverage</p>
              <h2 id="rule-families-title">Guardrail rule families</h2>
            </div>
            <div className="analytics-table-wrap">
              <table>
                <thead>
                  <tr><th>Rule family</th><th>Evaluated</th><th>Triggered</th></tr>
                </thead>
                <tbody>
                  {analytics.ruleFamilies.map((family) => (
                    <tr key={family.evaluationName}>
                      <th scope="row">{formatFamilyName(family.evaluationName)}</th>
                      <td>{family.total}</td>
                      <td>{family.triggered}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}