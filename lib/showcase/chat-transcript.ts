export type TranscriptTurnRole = "user" | "assistant";

export type ChatTranscriptTurn = {
  id: string;
  sequence: number;
  role: TranscriptTurnRole;
  message: string;
  createdAt: string;
};

const timestampFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function isTranscriptTurnRole(value: unknown): value is TranscriptTurnRole {
  return value === "user" || value === "assistant";
}

function isTranscriptTurn(value: unknown): value is ChatTranscriptTurn {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ChatTranscriptTurn>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.sequence === "number" &&
    isTranscriptTurnRole(candidate.role) &&
    typeof candidate.message === "string" &&
    typeof candidate.createdAt === "string"
  );
}

function parseTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

export function sortTranscriptTurnsStable(turns: ChatTranscriptTurn[]): ChatTranscriptTurn[] {
  return [...turns].sort((left, right) => {
    const timeDelta = parseTime(left.createdAt) - parseTime(right.createdAt);
    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left.sequence - right.sequence;
  });
}

export function parseTranscriptTurns(serialized: string | null): ChatTranscriptTurn[] {
  if (!serialized) {
    return [];
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return sortTranscriptTurnsStable(parsed.filter(isTranscriptTurn));
  } catch {
    return [];
  }
}

export function formatTranscriptTimestamp(createdAt: string): string {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "Timestamp unavailable";
  }

  return timestampFormatter.format(parsed);
}
