import { NextRequest } from "next/server";
import { CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { resetConversationSessionStoreForTests } from "@/lib/chat-session";
import { GET, PATCH, POST } from "@/app/api/chat/session/route";
import { POST as POST_RESET } from "@/app/api/chat/session/reset/route";

function buildRequest(
  body: unknown,
  correlationId = "cid-test",
  method: "POST" | "PATCH" = "POST"
): NextRequest {
  return new NextRequest("http://localhost:3030/api/chat/session", {
    method,
    headers: {
      "content-type": "application/json",
      [CORRELATION_ID_HEADER]: correlationId
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/chat/session", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
  });

  it("returns 201 with conversation id metadata", async () => {
    const response = await POST(buildRequest({ selectedPatientId: "patient-400" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("cid-test");
    expect(body.success).toBe(true);
    expect(body.data.conversationId).toMatch(/^conv_\d{8}T\d{6}Z_[a-f0-9]{12}$/);
    expect(body.data.idFormat).toBe("conv_<YYYYMMDDTHHMMSSZ>_<12hex>");
    expect(body.data.binding).toEqual({
      patientId: "patient-400",
      contextSnapshotRef: "showcase-profile-summary:patient-400",
      contextSnapshotVersion: "showcase.v1"
    });
  });

  it("returns structured 400 for malformed payload", async () => {
    const response = await POST(buildRequest({ clientConversationId: 42, selectedPatientId: "patient-400" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "INVALID_REQUEST_BODY"
      }
    });
  });

  it("returns structured 409 for reused client conversation id", async () => {
    const reusedId = "conv_20260730T120000Z_abcdef123456";

    const first = await POST(
      buildRequest({ clientConversationId: reusedId, selectedPatientId: "patient-400" }, "cid-1")
    );
    expect(first.status).toBe(201);

    const second = await POST(
      buildRequest({ clientConversationId: reusedId, selectedPatientId: "patient-400" }, "cid-2")
    );
    const body = await second.json();

    expect(second.status).toBe(409);
    expect(second.headers.get(CORRELATION_ID_HEADER)).toBe("cid-2");
    expect(body).toEqual({
      success: false,
      error: {
        code: "SESSION_ID_REUSED",
        message: "The provided conversation ID has already been used."
      }
    });
  });

  it("returns structured 400 for invalid selected patient", async () => {
    const response = await POST(buildRequest({ selectedPatientId: "patient-999" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "INVALID_PATIENT_ID"
      }
    });
  });
});

describe("GET/PATCH /api/chat/session", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
  });

  it("returns binding data by conversation id", async () => {
    const started = await POST(buildRequest({ selectedPatientId: "patient-401" }, "cid-start"));
    const startedBody = await started.json();

    const response = await GET(
      new NextRequest(
        `http://localhost:3030/api/chat/session?conversationId=${startedBody.data.conversationId}`,
        {
          method: "GET",
          headers: {
            [CORRELATION_ID_HEADER]: "cid-read"
          }
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("cid-read");
    expect(body.data.binding.patientId).toBe("patient-401");
  });

  it("updates binding on profile change event", async () => {
    const started = await POST(buildRequest({ selectedPatientId: "patient-400" }, "cid-start"));
    const startedBody = await started.json();

    const response = await PATCH(
      buildRequest(
        {
          conversationId: startedBody.data.conversationId,
          selectedPatientId: "patient-403"
        },
        "cid-patch",
        "PATCH"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("cid-patch");
    expect(body.data.binding.patientId).toBe("patient-403");
    expect(body.data.binding.contextSnapshotRef).toBe("showcase-profile-summary:patient-403");
  });
});

describe("POST /api/chat/session/reset", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
  });

  it("returns cleared reset confirmation", async () => {
    const started = await POST(buildRequest({ selectedPatientId: "patient-400" }, "cid-start"));
    const startedBody = await started.json();

    const response = await POST_RESET(
      new NextRequest("http://localhost:3030/api/chat/session/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CORRELATION_ID_HEADER]: "cid-reset"
        },
        body: JSON.stringify({ conversationId: startedBody.data.conversationId })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get(CORRELATION_ID_HEADER)).toBe("cid-reset");
    expect(body).toMatchObject({
      success: true,
      data: {
        conversationId: startedBody.data.conversationId,
        bindingCleared: true,
        sessionState: "ready_for_rebind"
      }
    });
  });

  it("is idempotent on repeated reset", async () => {
    const started = await POST(buildRequest({ selectedPatientId: "patient-401" }, "cid-start"));
    const startedBody = await started.json();

    const first = await POST_RESET(
      new NextRequest("http://localhost:3030/api/chat/session/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CORRELATION_ID_HEADER]: "cid-reset-1"
        },
        body: JSON.stringify({ conversationId: startedBody.data.conversationId })
      })
    );
    const firstBody = await first.json();

    const second = await POST_RESET(
      new NextRequest("http://localhost:3030/api/chat/session/reset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [CORRELATION_ID_HEADER]: "cid-reset-2"
        },
        body: JSON.stringify({ conversationId: startedBody.data.conversationId })
      })
    );
    const secondBody = await second.json();

    expect(firstBody.data.bindingCleared).toBe(true);
    expect(secondBody.data.bindingCleared).toBe(false);
    expect(secondBody.data.clearedTurnCount).toBe(0);
    expect(secondBody.data.sessionState).toBe("ready_for_rebind");
  });
});