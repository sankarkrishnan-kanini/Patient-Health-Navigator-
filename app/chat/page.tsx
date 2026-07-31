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
import {
  formatTranscriptTimestamp,
  parseTranscriptTurns,
  sortTranscriptTurnsStable,
  type ChatTranscriptTurn
} from "@/lib/showcase/chat-transcript";

const CHAT_SESSION_PROFILE_KEY = "chat.selectedProfileId";
const CHAT_TRANSCRIPT_KEY = "chat.transcript.v1";

type StoredTranscript = {
  profileId: string;
  turns: ChatTranscriptTurn[];
};

function parseStoredTranscript(serialized: string | null): StoredTranscript | null {
  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const candidate = parsed as Partial<StoredTranscript>;
    if (typeof candidate.profileId !== "string" || !Array.isArray(candidate.turns)) {
      return null;
    }

    const turns = parseTranscriptTurns(JSON.stringify(candidate.turns));

    return {
      profileId: candidate.profileId,
      turns
    };
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const [confirmedProfileId, setConfirmedProfileId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientProfileSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [loadFailure, setLoadFailure] = useState<ProfileLoadFailure | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);
  const [draftMessage, setDraftMessage] = useState<string>("");
  const [transcriptTurns, setTranscriptTurns] = useState<ChatTranscriptTurn[]>([]);
  const [nextTurnSequence, setNextTurnSequence] = useState<number>(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(CHAT_SESSION_PROFILE_KEY);
    if (stored && getShowcasePatientById(stored)) {
      setConfirmedProfileId(stored);
    }

    const storedTranscript = parseStoredTranscript(sessionStorage.getItem(CHAT_TRANSCRIPT_KEY));
    if (!storedTranscript || !getShowcasePatientById(storedTranscript.profileId)) {
      return;
    }

    setTranscriptTurns(storedTranscript.turns);
    const maxSequence = storedTranscript.turns.reduce(
      (currentMax, turn) => (turn.sequence > currentMax ? turn.sequence : currentMax),
      -1
    );
    setNextTurnSequence(maxSequence + 1);
  }, []);

  useEffect(() => {
    if (!confirmedProfileId) {
      sessionStorage.removeItem(CHAT_TRANSCRIPT_KEY);
      return;
    }

    if (transcriptTurns.length === 0) {
      sessionStorage.removeItem(CHAT_TRANSCRIPT_KEY);
      return;
    }

    const serialized = JSON.stringify({
      profileId: confirmedProfileId,
      turns: transcriptTurns
    } satisfies StoredTranscript);
    sessionStorage.setItem(CHAT_TRANSCRIPT_KEY, serialized);
  }, [confirmedProfileId, transcriptTurns]);

  const selectedProfile = useMemo(() => {
    if (!confirmedProfileId) {
      return null;
    }

    return getShowcasePatientById(confirmedProfileId) ?? null;
  }, [confirmedProfileId]);

  function handleConfirmSelection(profileId: string): void {
    if (profileId !== confirmedProfileId) {
      setTranscriptTurns([]);
      setNextTurnSequence(0);
      sessionStorage.removeItem(CHAT_TRANSCRIPT_KEY);
    }

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

    const baseTimestamp = new Date();
    const userTurn: ChatTranscriptTurn = {
      id: `turn-${nextTurnSequence.toString()}`,
      sequence: nextTurnSequence,
      role: "user",
      message: nextMessage,
      createdAt: baseTimestamp.toISOString()
    };
    const assistantTurn: ChatTranscriptTurn = {
      id: `turn-${(nextTurnSequence + 1).toString()}`,
      sequence: nextTurnSequence + 1,
      role: "assistant",
      message:
        "Message captured. I will ground follow-up guidance using your selected patient profile and session context.",
      createdAt: new Date(baseTimestamp.getTime() + 1000).toISOString()
    };

    setTranscriptTurns((current) => sortTranscriptTurnsStable([...current, userTurn, assistantTurn]));
    setNextTurnSequence((current) => current + 2);
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

          <section className="chat-transcript" aria-labelledby="chat-transcript-heading">
            <h3 id="chat-transcript-heading">Conversation Transcript</h3>
            <p className="chat-transcript-caption">
              Turns are grouped by speaker and include timestamps for readability.
            </p>

            {transcriptTurns.length === 0 ? (
              <p className="chat-transcript-empty">No transcript turns yet. Send a message to begin.</p>
            ) : (
              <ol className="chat-transcript-list" aria-live="polite" aria-relevant="additions text">
                {transcriptTurns.map((turn) => (
                  <li key={turn.id} className={`chat-turn chat-turn-${turn.role}`}>
                    <article aria-label={turn.role === "user" ? "User turn" : "Assistant turn"}>
                      <header className="chat-turn-header">
                        <span className="chat-turn-role">{turn.role === "user" ? "You" : "Assistant"}</span>
                        <time className="chat-turn-time" dateTime={turn.createdAt}>
                          {formatTranscriptTimestamp(turn.createdAt)}
                        </time>
                      </header>
                      <p className="chat-turn-message">{turn.message}</p>
                    </article>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <p className="chat-shell-note">The profile summary panel remains visible while chat is active.</p>
        </section>
      </section>
    </main>
  );
}