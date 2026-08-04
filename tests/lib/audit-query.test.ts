import { NextRequest } from "next/server";
import { POST as POST_CHAT } from "@/app/api/chat/route";
import { POST as POST_SESSION } from "@/app/api/chat/session/route";
import { GET as GET_AUDIT } from "@/app/api/chat/audit/route";
import { CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { resetConversationSessionStoreForTests } from "@/lib/chat-session";
import { resetGuardrailActivationEventStoreForTests } from "@/lib/guardrail-audit";
import { resetConversationTurnAuditStoreForTests } from "@/lib/conversation-turn-audit";

function buildJsonRequest(
  url: string,
  method: "POST",
  body: unknown,
  correlationId: string
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: {
      "content-type": "application/json",
      [CORRELATION_ID_HEADER]: correlationId
    },
    body: JSON.stringify(body)
  });
}

describe("GET /api/chat/audit", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
    resetConversationTurnAuditStoreForTests();
    resetGuardrailActivationEventStoreForTests();
  });

  it("returns chronologically ordered audit records for a conversation", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-401" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "I have chest pain and trouble breathing"
        },
        "cid-chat"
      )
    );

    const response = await GET_AUDIT(
      new NextRequest(
        `http://localhost:3030/api/chat/audit?conversationId=${startedBody.data.conversationId}&limit=20`,
        {
          method: "GET",
          headers: {
            [CORRELATION_ID_HEADER]: "cid-audit"
          }
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.conversationId).toBe(startedBody.data.conversationId);
    expect(body.data.records.length).toBeGreaterThanOrEqual(3);
    expect(body.data.records[0].timestamp <= body.data.records[1].timestamp).toBe(true);
    expect(body.data.turnRecords.length).toBeGreaterThan(0);
    expect(body.data.guardrailRecords.length).toBeGreaterThan(0);
    expect(body.data.pagination.totalCount).toBe(body.data.records.length);
  });

  it("supports time-range filtering and pagination", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-401" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "hello there"
        },
        "cid-chat-1"
      )
    );

    const first = await GET_AUDIT(
      new NextRequest(
        `http://localhost:3030/api/chat/audit?conversationId=${startedBody.data.conversationId}&limit=1&offset=0`,
        {
          method: "GET",
          headers: {
            [CORRELATION_ID_HEADER]: "cid-audit-1"
          }
        }
      )
    );
    const firstBody = await first.json();

    expect(first.status).toBe(200);
    expect(firstBody.data.pagination.returnedCount).toBe(1);
    expect(firstBody.data.pagination.hasMore).toBe(true);

    const startTime = firstBody.data.records[0].timestamp;
    const ranged = await GET_AUDIT(
      new NextRequest(
        `http://localhost:3030/api/chat/audit?conversationId=${startedBody.data.conversationId}&startTime=${startTime}`,
        {
          method: "GET",
          headers: {
            [CORRELATION_ID_HEADER]: "cid-audit-2"
          }
        }
      )
    );
    const rangedBody = await ranged.json();

    expect(ranged.status).toBe(200);
    expect(rangedBody.data.records.length).toBeGreaterThan(0);
    expect(rangedBody.data.records[0].timestamp >= startTime).toBe(true);
  });
});