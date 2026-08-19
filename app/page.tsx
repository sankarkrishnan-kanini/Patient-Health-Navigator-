import Link from "next/link";
import { ArrowUpRight, MessageCircle, ShieldCheck, UserRound } from "lucide-react";

export default function HomePage() {
  return (
    <main className="workspace-page home-page">
      <section className="home-overview" aria-labelledby="home-heading">
        <div>
          <p className="eyebrow">Patient AI Health Navigator</p>
          <h1 id="home-heading">Patient AI Health Navigator</h1>
          <p className="home-lede">
            A focused view of every patient conversation. Select a synthetic profile, review active
            clinical context, and continue a guardrail-aware conversation from one secure workspace.
          </p>
        </div>
        <div className="workspace-status" aria-label="Workspace status">
          <span className="status-dot" aria-hidden="true" />
          Local workspace online
        </div>
      </section>

      <section className="workspace-actions" aria-label="Workspace actions">
        <Link className="workspace-action workspace-action-primary" href="/profile" aria-label="Profile Placeholder - Browse patient profiles">
          <span className="workspace-action-icon" aria-hidden="true"><UserRound size={23} /></span>
          <span>
            <span className="workspace-action-kicker">Patient context</span>
            <strong>Browse profiles</strong>
            <small>Review conditions, medications, care tasks, and visits.</small>
          </span>
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>

        <Link className="workspace-action" href="/chat" aria-label="Chat Placeholder - Open care conversations">
          <span className="workspace-action-icon" aria-hidden="true"><MessageCircle size={23} /></span>
          <span>
            <span className="workspace-action-kicker">Care conversation</span>
            <strong>Open chat</strong>
            <small>Continue with profile-aware responses and session context.</small>
          </span>
          <ArrowUpRight size={20} aria-hidden="true" />
        </Link>
      </section>

      <section className="assurance-strip" aria-label="Safety controls">
        <ShieldCheck size={22} aria-hidden="true" />
        <div>
          <strong>Built for responsible patient context</strong>
          <p>Profile selection and safety controls remain visible throughout the workflow.</p>
        </div>
      </section>
    </main>
  );
}