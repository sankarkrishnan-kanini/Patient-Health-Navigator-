"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "react-toastify";
import { PatientSelector } from "@/app/chat/_components/patient-selector";
import { ProfileSummaryPanel } from "@/app/chat/_components/profile-summary-panel";
import type { ShowcasePatientOption } from "@/lib/showcase/patient-options";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";
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

const CHAT_SESSION_PROFILE_KEY = "profile.selectedProfileId";
const CHAT_TRANSCRIPT_KEY = "chat.transcript.v1";

type StoredTranscript = {
  profileId: string;
  turns: ChatTranscriptTurn[];
};

type SessionStartApiResponse = {
  data?: {
    conversationId?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type ChatApiResponse = {
  data?: {
    turn?: {
      assistantMessage?: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiRequestError = Error & {
  code?: string;
  status?: number;
};

function toApiRequestError(
  fallbackMessage: string,
  payload: { code?: string; message?: string },
  status: number
): ApiRequestError {
  const error = new Error(payload.message || fallbackMessage);
  const apiError = error as ApiRequestError;
  apiError.code = payload.code;
  apiError.status = status;
  return apiError;
}

async function createChatSessionForProfile(profileId: string): Promise<string> {
  const res = await fetch("/api/chat/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selectedPatientId: profileId
    })
  });

  const data = (await res.json()) as SessionStartApiResponse;
  if (!res.ok) {
    throw toApiRequestError(
      "Failed to start session",
      {
        code: data.error?.code,
        message: data.error?.message
      },
      res.status
    );
  }

  const nextConversationId = data.data?.conversationId;
  if (!nextConversationId) {
    throw new Error("Session started without a conversation id.");
  }

  return nextConversationId;
}

async function requestChatAssistantMessage(
  activeConversationId: string,
  message: string
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId: activeConversationId,
      message
    })
  });

  const data = (await res.json()) as ChatApiResponse;
  if (!res.ok) {
    throw toApiRequestError(
      "Failed to get response",
      {
        code: data.error?.code,
        message: data.error?.message
      },
      res.status
    );
  }

  return data.data?.turn?.assistantMessage || "I couldn't generate a response. Please try again.";
}

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
  const [patientOptions, setPatientOptions] = useState<ShowcasePatientOption[]>([]);
  const [optionsLoadError, setOptionsLoadError] = useState<string | null>(null);
  const [confirmedProfileId, setConfirmedProfileId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [summary, setSummary] = useState<PatientProfileSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [loadFailure, setLoadFailure] = useState<ProfileLoadFailure | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);
  const [draftMessage, setDraftMessage] = useState<string>("");
  const [transcriptTurns, setTranscriptTurns] = useState<ChatTranscriptTurn[]>([]);
  const [nextTurnSequence, setNextTurnSequence] = useState<number>(0);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState<boolean>(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(CHAT_SESSION_PROFILE_KEY);
    if (stored) {
      setConfirmedProfileId(stored);
    }

    const storedTranscript = parseStoredTranscript(sessionStorage.getItem(CHAT_TRANSCRIPT_KEY));
    if (!storedTranscript) {
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
    let isCancelled = false;

    async function loadPatientOptions() {
      setIsOptionsLoading(true);

      try {
        const response = await fetch("/api/patient-profile/options", { cache: "no-store" });
        const body = await response.json();

        if (!response.ok || !body?.data?.options || !Array.isArray(body.data.options)) {
          if (!isCancelled) {
            setPatientOptions([]);
          }
          return;
        }

        if (isCancelled) {
          return;
        }

        const options = body.data.options as ShowcasePatientOption[];
        setPatientOptions(options);

        const knownProfileIds = new Set(options.map((option) => option.profileId));
        const storedProfileId = sessionStorage.getItem(CHAT_SESSION_PROFILE_KEY);
        if (storedProfileId && knownProfileIds.has(storedProfileId)) {
          setConfirmedProfileId(storedProfileId);
        } else if (storedProfileId) {
          sessionStorage.removeItem(CHAT_SESSION_PROFILE_KEY);
          setConfirmedProfileId(null);
          setConversationId(null);
        }

        const storedTranscript = parseStoredTranscript(sessionStorage.getItem(CHAT_TRANSCRIPT_KEY));
        if (!storedTranscript || !knownProfileIds.has(storedTranscript.profileId)) {
          sessionStorage.removeItem(CHAT_TRANSCRIPT_KEY);
          setTranscriptTurns([]);
          setNextTurnSequence(0);
        }
      } catch {
        if (!isCancelled) {
          setPatientOptions([]);
          setConfirmedProfileId(null);
          setConversationId(null);
        }
      } finally {
        if (!isCancelled) {
          setIsOptionsLoading(false);
        }
      }
    }

    void loadPatientOptions();

    return () => {
      isCancelled = true;
    };
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

    return patientOptions.find((option) => option.profileId === confirmedProfileId) ?? null;
  }, [confirmedProfileId, patientOptions]);

  function handleConfirmSelection(profileId: string): void {
    if (profileId !== confirmedProfileId) {
      setTranscriptTurns([]);
      setNextTurnSequence(0);
      setConversationId(null);
      sessionStorage.removeItem(CHAT_TRANSCRIPT_KEY);
    }

    setConfirmedProfileId(profileId);
    sessionStorage.setItem(CHAT_SESSION_PROFILE_KEY, profileId);

    // Start a new chat session
    fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedPatientId: profileId
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to start session");
        }
        return data;
      })
      .then((data) => {
        setConversationId(data.data.conversationId);
      })
      .catch((error) => {
        console.error("Session error:", error);
        setConversationId(null);
      });
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

        const response = await fetch(
          `/api/patient-profile?profileId=${encodeURIComponent(profileId)}`,
          { cache: "no-store" }
        );
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error?.message ?? "PROFILE_SUMMARY_NOT_FOUND");
        }

        const payload = body?.data?.summary as PatientProfileSummary | undefined;
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

    if (!chatGateState.isChatEnabled || isAwaitingResponse || !conversationId) {
      return;
    }

    const nextMessage = draftMessage.trim();
    if (nextMessage.length === 0) {
      return;
    }

    setIsAwaitingResponse(true);
    setDraftMessage("");

    const baseTimestamp = new Date();
    const userTurn: ChatTranscriptTurn = {
      id: `turn-${nextTurnSequence.toString()}`,
      sequence: nextTurnSequence,
      role: "user",
      message: nextMessage,
      createdAt: baseTimestamp.toISOString()
    };

    // Optimistically add user turn immediately
    setTranscriptTurns((current) => sortTranscriptTurnsStable([...current, userTurn]));

    const appendAssistantTurn = (assistantMessage: string): void => {
      const assistantTurn: ChatTranscriptTurn = {
        id: `turn-${(nextTurnSequence + 1).toString()}`,
        sequence: nextTurnSequence + 1,
        role: "assistant",
        message: assistantMessage,
        createdAt: new Date(baseTimestamp.getTime() + 1000).toISOString()
      };

      setTranscriptTurns((current) =>
        sortTranscriptTurnsStable([...current, assistantTurn])
      );
      setNextTurnSequence((current) => current + 2);
    };

    const appendErrorTurn = (error: unknown): void => {
      const requestError = error as ApiRequestError;
      const renderedMessage = requestError?.message || "Failed to get response";

      console.error("Chat error:", requestError);
      toast.error(renderedMessage);
      const errorTurn: ChatTranscriptTurn = {
        id: `turn-${(nextTurnSequence + 1).toString()}`,
        sequence: nextTurnSequence + 1,
        role: "assistant",
        message: `Error: ${renderedMessage}`,
        createdAt: new Date(baseTimestamp.getTime() + 1000).toISOString()
      };

      setTranscriptTurns((current) =>
        sortTranscriptTurnsStable([...current, errorTurn])
      );
      setNextTurnSequence((current) => current + 2);
    };

    const submit = async (): Promise<void> => {
      try {
        const assistantMessage = await requestChatAssistantMessage(conversationId, nextMessage);
        appendAssistantTurn(assistantMessage);
        toast.success("Response received.");
        return;
      } catch (error) {
        const requestError = error as ApiRequestError;
        const shouldRecoverSession =
          (requestError.code === "SESSION_NOT_FOUND" || requestError.status === 404) &&
          typeof confirmedProfileId === "string";

        if (shouldRecoverSession) {
          try {
            console.warn("Session not found, recreating...", { code: requestError.code, status: requestError.status });
            const nextConversationId = await createChatSessionForProfile(confirmedProfileId);
            setConversationId(nextConversationId);
            const assistantMessage = await requestChatAssistantMessage(nextConversationId, nextMessage);
            appendAssistantTurn(assistantMessage);
            return;
          } catch (retryError) {
            console.error("Session recovery failed:", retryError);
            appendErrorTurn(retryError);
            return;
          }
        }

        appendErrorTurn(requestError);
      } finally {
        setIsAwaitingResponse(false);
      }
    };

    void submit();
  }

  const isSendDisabled = !chatGateState.isChatEnabled || draftMessage.trim().length === 0 || isAwaitingResponse || !conversationId;

  return (
    <main className="workspace-page chat-page">
      <header className="page-intro">
        <div>
          <p className="eyebrow">Care conversation</p>
          <h1>Patient Chat</h1>
        </div>
      </header>
      <p className="chat-subtitle">
        Select a patient to load the active clinical context before sending a message.
      </p>

      <PatientSelector
        options={patientOptions}
        confirmedProfileId={confirmedProfileId}
        onConfirmSelection={handleConfirmSelection}
      />

      {optionsLoadError && <p className="page-error" role="alert">{optionsLoadError}</p>}

      <section className="chat-workspace">
        <ProfileSummaryPanel
          profileLabel={selectedProfile?.label ?? null}
          summary={summary}
          isLoading={isSummaryLoading}
          loadFailure={loadFailure}
          onRetry={handleRetryProfileLoad}
        />

        <section className="chat-shell" aria-live="polite">
          <div className="panel-heading">
            <span className="panel-icon" aria-hidden="true"><MessageCircle size={18} /></span>
            <h2>Conversation</h2>
          </div>
          <p>
            {selectedProfile
              ? `Ready to start conversation with ${selectedProfile.label}.`
              : isOptionsLoading
                ? "Loading Synthea profiles for chat."
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
                <Send size={16} aria-hidden="true" />
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