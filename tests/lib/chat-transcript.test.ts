import {
  formatTranscriptTimestamp,
  parseTranscriptTurns,
  sortTranscriptTurnsStable,
  type ChatTranscriptTurn
} from "@/lib/showcase/chat-transcript";

describe("chat transcript utilities", () => {
  it("sorts turns by timestamp and preserves stable sequence for same timestamp", () => {
    const turns: ChatTranscriptTurn[] = [
      {
        id: "turn-2",
        sequence: 2,
        role: "assistant",
        message: "assistant message",
        createdAt: "2026-07-31T12:00:01.000Z"
      },
      {
        id: "turn-0",
        sequence: 0,
        role: "user",
        message: "first",
        createdAt: "2026-07-31T12:00:00.000Z"
      },
      {
        id: "turn-1",
        sequence: 1,
        role: "assistant",
        message: "second",
        createdAt: "2026-07-31T12:00:00.000Z"
      }
    ];

    const sorted = sortTranscriptTurnsStable(turns);

    expect(sorted.map((turn) => turn.id)).toEqual(["turn-0", "turn-1", "turn-2"]);
  });

  it("parses and validates stored transcript turns", () => {
    const parsed = parseTranscriptTurns(
      JSON.stringify([
        {
          id: "turn-1",
          sequence: 1,
          role: "assistant",
          message: "message",
          createdAt: "2026-07-31T12:00:01.000Z"
        },
        {
          id: "turn-0",
          sequence: 0,
          role: "user",
          message: "message",
          createdAt: "2026-07-31T12:00:00.000Z"
        },
        {
          id: "broken",
          sequence: "1",
          role: "system",
          message: "skip",
          createdAt: "invalid"
        }
      ])
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).toBe("turn-0");
    expect(parsed[1]?.id).toBe("turn-1");
  });

  it("returns a readable timestamp and safe fallback for invalid timestamps", () => {
    const readable = formatTranscriptTimestamp("2026-07-31T12:00:00.000Z");

    expect(readable).toMatch(/[A-Za-z]{3} [0-9]{2}, [0-9]{4}/);
    expect(formatTranscriptTimestamp("invalid")).toBe("Timestamp unavailable");
  });
});
