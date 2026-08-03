import { NextRequest } from "next/server";
import { POST as POST_CHAT } from "@/app/api/chat/route";
import { GET as GET_GUARDRAIL_EVENTS } from "@/app/api/chat/guardrail-events/route";
import { POST as POST_SESSION } from "@/app/api/chat/session/route";
import { CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { resetConversationSessionStoreForTests } from "@/lib/chat-session";
import { resetGuardrailActivationEventStoreForTests } from "@/lib/guardrail-audit";

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

describe("GET /api/chat/guardrail-events", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
    resetGuardrailActivationEventStoreForTests();
  });

  it("returns persisted emergency guardrail activation events for review", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-401" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const emergency = await POST_CHAT(
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
    const emergencyBody = await emergency.json();

    expect(emergency.status).toBe(200);
    expect(emergencyBody.data.safety.guardrailAudit.ruleId).toBe("ER-CHEST-PAIN-001");
    expect(emergencyBody.data.safety.guardrailAudit.triggerReason).toBe("emergency_trigger_match");

    const review = await GET_GUARDRAIL_EVENTS(
      new NextRequest(
        `http://localhost:3030/api/chat/guardrail-events?conversationId=${startedBody.data.conversationId}`,
        {
          method: "GET",
          headers: {
            [CORRELATION_ID_HEADER]: "cid-review"
          }
        }
      )
    );
    const reviewBody = await review.json();

    expect(review.status).toBe(200);
    expect(reviewBody.success).toBe(true);
    expect(reviewBody.data.count).toBe(1);
    expect(reviewBody.data.events[0]).toMatchObject({
      eventType: "emergency_guardrail_activation",
      conversationId: startedBody.data.conversationId,
      triggerReason: "emergency_trigger_match",
      ruleId: "ER-CHEST-PAIN-001"
    });
    expect(reviewBody.data.events[0].timestamp).toBeTruthy();
  });
});
