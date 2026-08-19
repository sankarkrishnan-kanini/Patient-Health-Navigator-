import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";
import type { ProfileLoadFailure } from "@/lib/showcase/profile-load-failure";
import { CalendarDays, ClipboardCheck, Pill, RotateCw, Stethoscope } from "lucide-react";

type ProfileSummaryPanelProps = {
  profileLabel: string | null;
  summary: PatientProfileSummary | null;
  isLoading: boolean;
  loadFailure: ProfileLoadFailure | null;
  onRetry: () => void;
};

function renderEmptyText(itemsCount: number, fallback: string): string {
  return itemsCount > 0 ? "" : fallback;
}

function formatVisitDate(start: string | null): string {
  if (!start) {
    return "Date pending";
  }

  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) {
    return "Date pending";
  }

  return parsed.toLocaleString();
}

function LoadingSection({ title }: { title: string }) {
  return (
    <section className="summary-section" aria-busy="true">
      <h3>{title}</h3>
      <div className="summary-skeleton" />
      <div className="summary-skeleton" />
    </section>
  );
}

export function ProfileSummaryPanel({
  profileLabel,
  summary,
  isLoading,
  loadFailure,
  onRetry
}: ProfileSummaryPanelProps) {
  return (
    <aside className="profile-panel" aria-live="polite">
      <h2>Profile Summary</h2>
      <p className="profile-panel-caption">
        {profileLabel ? `Current profile: ${profileLabel}` : "Confirm a profile to view summary details."}
      </p>

      {isLoading && (
        <div className="summary-stack">
          <LoadingSection title="Active Conditions" />
          <LoadingSection title="Active Medications" />
          <LoadingSection title="Care Tasks" />
          <LoadingSection title="Upcoming Visits" />
        </div>
      )}

      {!isLoading && loadFailure && (
        <div className="summary-failure" role="status" aria-live="polite">
          <p className="summary-failure-title">Unable to load profile summary</p>
          <p>{loadFailure.message}</p>
          <p>{loadFailure.retryGuidance}</p>
          <button type="button" className="summary-retry" onClick={onRetry}>
            <RotateCw size={16} aria-hidden="true" />
            Retry Profile Load
          </button>
        </div>
      )}

      {!isLoading && !loadFailure && !summary && (
        <div className="summary-empty">
          <p>No summary available yet. Select a profile to load clinical context.</p>
        </div>
      )}

      {!isLoading && !loadFailure && summary && (
        <div className="summary-stack">
          <section className="summary-section">
            <h3><Stethoscope size={16} aria-hidden="true" /> Active Conditions</h3>
            {summary.activeConditions.length > 0 ? (
              <ul>
                {summary.activeConditions.map((condition) => (
                  <li key={condition.conditionId}>{condition.label}</li>
                ))}
              </ul>
            ) : (
              <p>{renderEmptyText(summary.activeConditions.length, "No active conditions listed.")}</p>
            )}
          </section>

          <section className="summary-section">
            <h3><Pill size={16} aria-hidden="true" /> Active Medications</h3>
            {summary.activeMedications.length > 0 ? (
              <ul>
                {summary.activeMedications.map((medication) => (
                  <li key={medication.medicationId}>{medication.name}</li>
                ))}
              </ul>
            ) : (
              <p>{renderEmptyText(summary.activeMedications.length, "No active medications listed.")}</p>
            )}
          </section>

          <section className="summary-section">
            <h3><ClipboardCheck size={16} aria-hidden="true" /> Care Tasks</h3>
            {summary.careTasks.length > 0 ? (
              <ul>
                {summary.careTasks.map((task) => (
                  <li key={task.carePlanId}>
                    {task.description} ({task.status})
                  </li>
                ))}
              </ul>
            ) : (
              <p>{renderEmptyText(summary.careTasks.length, "No care tasks listed.")}</p>
            )}
          </section>

          <section className="summary-section">
            <h3><CalendarDays size={16} aria-hidden="true" /> Upcoming Visits</h3>
            {summary.upcomingVisits.length > 0 ? (
              <ul>
                {summary.upcomingVisits.map((visit) => (
                  <li key={visit.encounterId}>
                    {formatVisitDate(visit.start)} ({visit.status})
                  </li>
                ))}
              </ul>
            ) : (
              <p>{renderEmptyText(summary.upcomingVisits.length, "No upcoming visits scheduled.")}</p>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}