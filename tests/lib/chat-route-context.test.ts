import { NextRequest } from "next/server";
import { POST as POST_CHAT } from "@/app/api/chat/route";
import { POST as POST_SESSION } from "@/app/api/chat/session/route";
import { POST as POST_RESET } from "@/app/api/chat/session/reset/route";
import { CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import {
  getConversationTurnCount,
  resetConversationSessionStoreForTests
} from "@/lib/chat-session";

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

describe("POST /api/chat request context propagation", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
  });

  it("rejects missing conversation id in chat payload", async () => {
    const response = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        { message: "hello" },
        "cid-missing"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "INVALID_REQUEST_BODY"
      }
    });
  });

  it("blocks chat when conversation id has no active bound session", async () => {
    const response = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: "conv_20260730T120000Z_abcdef123456",
          message: "hello"
        },
        "cid-missing-session"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({
      success: false,
      error: {
        code: "SESSION_NOT_FOUND",
        message: "Conversation session was not found."
      }
    });
  });

  it("injects conversation and patient context for valid session", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-401" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const response = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "Summarize meds"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("cid-chat");
    expect(body).toMatchObject({
      success: true,
      data: {
        conversationId: startedBody.data.conversationId,
        patientId: "patient-401",
        contextSnapshotRef: "showcase-profile-summary:patient-401",
        contextSnapshotVersion: "showcase.v1",
        requestAccepted: true
      }
    });
  });

  it("keeps context injection consistent across multi-turn requests", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const turnOne = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "turn one"
        },
        "cid-chat-1"
      )
    );
    const turnOneBody = await turnOne.json();

    const turnTwo = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "turn two"
        },
        "cid-chat-2"
      )
    );
    const turnTwoBody = await turnTwo.json();

    expect(turnOne.status).toBe(200);
    expect(turnTwo.status).toBe(200);
    expect(turnOneBody.data.conversationId).toBe(startedBody.data.conversationId);
    expect(turnTwoBody.data.conversationId).toBe(startedBody.data.conversationId);
    expect(turnOneBody.data.contextSnapshotRef).toBe("showcase-profile-summary:patient-403");
    expect(turnTwoBody.data.contextSnapshotRef).toBe("showcase-profile-summary:patient-403");
    expect(turnOneBody.data.patientId).toBe("patient-403");
    expect(turnTwoBody.data.patientId).toBe("patient-403");
  });

  it("blocks chat after reset until session is rebound", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-400" },
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
          message: "turn one"
        },
        "cid-chat-1"
      )
    );

    const reset = await POST_RESET(
      new NextRequest("http://localhost:3030/api/chat/session/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CORRELATION_ID_HEADER]: "cid-reset"
        },
        body: JSON.stringify({ conversationId: startedBody.data.conversationId })
      })
    );
    const resetBody = await reset.json();

    expect(reset.status).toBe(200);
    expect(resetBody.data.bindingCleared).toBe(true);
    expect(resetBody.data.clearedTurnCount).toBe(1);

    const blocked = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "turn after reset"
        },
        "cid-chat-2"
      )
    );
    const blockedBody = await blocked.json();

    expect(blocked.status).toBe(409);
    expect(blockedBody).toEqual({
      success: false,
      error: {
        code: "SESSION_BINDING_MISSING",
        message: "Session binding is cleared. Rebind a patient context before sending chat requests."
      }
    });
  });

  it("preserves patient context and turn memory isolation across concurrent sessions", async () => {
    const sessionA = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-400" },
        "cid-same-user"
      )
    );
    const sessionABody = await sessionA.json();

    const sessionB = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-same-user"
      )
    );
    const sessionBBody = await sessionB.json();

    expect(sessionABody.data.conversationId).not.toBe(sessionBBody.data.conversationId);

    const aTurnOne = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionABody.data.conversationId,
          message: "A turn 1"
        },
        "cid-a-1"
      )
    );
    const aTurnOneBody = await aTurnOne.json();

    const bTurnOne = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionBBody.data.conversationId,
          message: "B turn 1"
        },
        "cid-b-1"
      )
    );
    const bTurnOneBody = await bTurnOne.json();

    const aTurnTwo = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionABody.data.conversationId,
          message: "A turn 2"
        },
        "cid-a-2"
      )
    );
    const aTurnTwoBody = await aTurnTwo.json();

    expect(aTurnOne.status).toBe(200);
    expect(bTurnOne.status).toBe(200);
    expect(aTurnTwo.status).toBe(200);

    expect(aTurnOneBody.data.patientId).toBe("patient-400");
    expect(aTurnTwoBody.data.patientId).toBe("patient-400");
    expect(bTurnOneBody.data.patientId).toBe("patient-403");

    expect(aTurnOneBody.data.contextSnapshotRef).toBe("showcase-profile-summary:patient-400");
    expect(aTurnTwoBody.data.contextSnapshotRef).toBe("showcase-profile-summary:patient-400");
    expect(bTurnOneBody.data.contextSnapshotRef).toBe("showcase-profile-summary:patient-403");

    expect(getConversationTurnCount(sessionABody.data.conversationId)).toBe(2);
    expect(getConversationTurnCount(sessionBBody.data.conversationId)).toBe(1);
  });

  it("applies reset only to the targeted session and keeps unrelated session active", async () => {
    const sessionA = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-401" },
        "cid-user-a"
      )
    );
    const sessionABody = await sessionA.json();

    const sessionB = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-404" },
        "cid-user-b"
      )
    );
    const sessionBBody = await sessionB.json();

    await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionABody.data.conversationId,
          message: "A initial"
        },
        "cid-a-initial"
      )
    );
    await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionBBody.data.conversationId,
          message: "B initial"
        },
        "cid-b-initial"
      )
    );

    const resetA = await POST_RESET(
      new NextRequest("http://localhost:3030/api/chat/session/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CORRELATION_ID_HEADER]: "cid-reset-a"
        },
        body: JSON.stringify({ conversationId: sessionABody.data.conversationId })
      })
    );
    const resetABody = await resetA.json();

    expect(resetA.status).toBe(200);
    expect(resetABody.data.bindingCleared).toBe(true);
    expect(resetABody.data.clearedTurnCount).toBe(1);

    const aBlocked = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionABody.data.conversationId,
          message: "A blocked"
        },
        "cid-a-after-reset"
      )
    );
    const aBlockedBody = await aBlocked.json();

    const bContinues = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: sessionBBody.data.conversationId,
          message: "B continues"
        },
        "cid-b-after-reset-a"
      )
    );
    const bContinuesBody = await bContinues.json();

    expect(aBlocked.status).toBe(409);
    expect(aBlockedBody.error.code).toBe("SESSION_BINDING_MISSING");

    expect(bContinues.status).toBe(200);
    expect(bContinuesBody.data.patientId).toBe("patient-404");
    expect(bContinuesBody.data.contextSnapshotRef).toBe("showcase-profile-summary:patient-404");

    expect(getConversationTurnCount(sessionABody.data.conversationId)).toBe(0);
    expect(getConversationTurnCount(sessionBBody.data.conversationId)).toBe(2);
  });
});