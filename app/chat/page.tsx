"use client";

import { useEffect, useMemo, useState } from "react";
import { PatientSelector } from "@/app/chat/_components/patient-selector";
import { ProfileSummaryPanel } from "@/app/chat/_components/profile-summary-panel";
import {
  getShowcasePatientById,
  SHOWCASE_PATIENT_OPTIONS
} from "@/lib/showcase/patient-options";
import {
  fetchShowcaseProfileSummary,
  type PatientProfileSummary
} from "@/lib/showcase/profile-summary";
import { getChatGateState } from "@/lib/showcase/chat-gating";
import {
  classifyProfileLoadFailure,
  type ProfileLoadFailure
} from "@/lib/showcase/profile-load-failure";

const CHAT_SESSION_PROFILE_KEY = "chat.selectedProfileId";

export default function ChatPage() {
  const [confirmedProfileId, setConfirmedProfileId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientProfileSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [loadFailure, setLoadFailure] = useState<ProfileLoadFailure | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);
  const [draftMessage, setDraftMessage] = useState<string>("");
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem(CHAT_SESSION_PROFILE_KEY);
    if (!stored || !getShowcasePatientById(stored)) {
      return;
    }

    setConfirmedProfileId(stored);
  }, []);

  const selectedProfile = useMemo(() => {
    if (!confirmedProfileId) {
      return null;
    }

    return getShowcasePatientById(confirmedProfileId) ?? null;
  }, [confirmedProfileId]);

  function handleConfirmSelection(profileId: string): void {
    setConfirmedProfileId(profileId);
    sessionStorage.setItem(CHAT_SESSION_PROFILE_KEY, profileId);
  }

  useEffect(() => {
    let isCancelled = false;

    function shouldSimulateFailureOnce(): boolean {
      if (process.env.NODE_ENV === "production") {
        return false;
      }

      const testWindow = window as Window & { __PHN_FAIL_PROFILE_LOAD_ONCE__?: boolean };
      if (!testWindow.__PHN_FAIL_PROFILE_LOAD_ONCE__) {
        return false;
      }

      testWindow.__PHN_FAIL_PROFILE_LOAD_ONCE__ = false;
      return true;
    }

    async function loadSummary(profileId: string): Promise<void> {
      setSummary(null);
      setLoadFailure(null);
      setIsSummaryLoading(true);

      try {
        if (shouldSimulateFailureOnce()) {
          throw new Error("SIMULATED_PROFILE_LOAD_FAILURE");
        }

        const payload = await fetchShowcaseProfileSummary(profileId);

        if (!payload) {
          throw new Error("PROFILE_SUMMARY_NOT_FOUND");
        }

        if (isCancelled) {
          return;
        }

        setSummary(payload);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setSummary(null);
        setLoadFailure(classifyProfileLoadFailure(error));
      } finally {
        if (!isCancelled) {
          setIsSummaryLoading(false);
        }
      }
    }

    if (!confirmedProfileId) {
      setSummary(null);
      setLoadFailure(null);
      setIsSummaryLoading(false);
      setDraftMessage("");
      return () => {
        isCancelled = true;
      };
    }

    setDraftMessage("");
    void loadSummary(confirmedProfileId);

    return () => {
      isCancelled = true;
    };
  }, [confirmedProfileId, reloadCounter]);

  function handleRetryProfileLoad(): void {
    if (!confirmedProfileId || isSummaryLoading) {
      return;
    }

    setReloadCounter((current) => current + 1);
  }

  const chatGateState = useMemo(
    () =>
      getChatGateState({
        confirmedProfileId,
        isSummaryLoading,
        summary,
        loadFailure
      }),
    [confirmedProfileId, isSummaryLoading, summary, loadFailure]
  );

  function handleChatSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!chatGateState.isChatEnabled) {
      return;
    }

    const nextMessage = draftMessage.trim();
    if (nextMessage.length === 0) {
      return;
    }

    const profileLabel = selectedProfile?.label ?? "Selected profile";
    setQueuedMessages((current) => [...current, `${profileLabel}: ${nextMessage}`]);
    setDraftMessage("");
  }

  const isSendDisabled = !chatGateState.isChatEnabled || draftMessage.trim().length === 0;

  return (
    <main>
      <h1>Patient Chat</h1>
      <p className="chat-subtitle">
        Select a showcase profile before starting chat. Profile selection does not send a chat request.
      </p>

      <PatientSelector
        options={SHOWCASE_PATIENT_OPTIONS}
        confirmedProfileId={confirmedProfileId}
        onConfirmSelection={handleConfirmSelection}
      />

      <section className="chat-workspace">
        <ProfileSummaryPanel
          profileLabel={selectedProfile?.label ?? null}
          summary={summary}
          isLoading={isSummaryLoading}
          loadFailure={loadFailure}
          onRetry={handleRetryProfileLoad}
        />

        <section className="chat-shell" aria-live="polite">
          <h2>Chat Shell</h2>
          <p>
            {selectedProfile
              ? `Ready to start conversation with ${selectedProfile.label}.`
              : "Confirm a profile to enable the chat workflow in the next task."}
          </p>

          <p className="chat-gate-message" role="status" aria-live="polite">
            {chatGateState.reason}
          </p>

          <form className="chat-composer" onSubmit={handleChatSubmit}>
            <label htmlFor="chat-message" className="chat-label">
              Message
            </label>
            <textarea
              id="chat-message"
              name="chat-message"
              rows={4}
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.currentTarget.value)}
              disabled={!chatGateState.isChatEnabled}
              placeholder="Type your message when chat is enabled"
            />
            <div className="chat-actions">
              <button type="submit" disabled={isSendDisabled}>
                Send
              </button>
            </div>
          </form>

          {queuedMessages.length > 0 && (
            <section className="chat-queued">
              <h3>Queued Messages</h3>
              <ul>
                {queuedMessages.map((message, index) => (
                  <li key={`${message}-${index.toString()}`}>{message}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="chat-shell-note">The profile summary panel remains visible while chat is active.</p>
        </section>
      </section>
    </main>
  );
}