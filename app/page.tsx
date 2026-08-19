import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Patient AI Health Navigator</h1>
      <p>
        Workspace scaffold is ready. Use the placeholders below to continue implementation for
        chat and patient profile workflows.
      </p>

      <div className="card-grid">
        <Link className="card" href="/chat">
          <h2>Chat Placeholder</h2>
          <p>Base route for conversation UI and future guardrail-integrated workflows.</p>
        </Link>

        <Link className="card" href="/profile">
          <h2>Profile Placeholder</h2>
          <p>Base route for synthetic patient selection and summary panel workflows.</p>
        </Link>

        <Link className="card" href="/analytics/guardrails">
          <h2>Guardrail Analytics</h2>
          <p>Review critical, medication, and routine safety prompt classifications.</p>
        </Link>
      </div>
    </main>
  );
}