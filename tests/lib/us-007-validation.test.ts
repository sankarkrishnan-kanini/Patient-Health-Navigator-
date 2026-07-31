import { NextRequest } from "next/server";
import { POST as POST_CHAT } from "@/app/api/chat/route";
import { POST as POST_SESSION } from "@/app/api/chat/session/route";
import { CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import { resetConversationSessionStoreForTests } from "@/lib/chat-session";

function buildJsonRequest(url: string, body: unknown, correlationId: string): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [CORRELATION_ID_HEADER]: correlationId
    },
    body: JSON.stringify(body)
  });
}

async function askChat(patientId: string, message: string, suffix: string): Promise<string> {
  const started = await POST_SESSION(
    buildJsonRequest(
      "http://localhost:3030/api/chat/session",
      { selectedPatientId: patientId },
      `cid-session-${suffix}`
    )
  );
  const startedBody = await started.json();

  const response = await POST_CHAT(
    buildJsonRequest(
      "http://localhost:3030/api/chat",
      {
        conversationId: startedBody.data.conversationId,
        message
      },
      `cid-chat-${suffix}`
    )
  );
  const body = await response.json();

  expect(response.status).toBe(200);
  return body.data.turn.assistantMessage as string;
}

describe("US-007 validation report", () => {
  beforeEach(() => {
    resetConversationSessionStoreForTests();
  });

  it("confirms all US-007 criteria pass with current guidance controls", async () => {
    const medicationMessage = await askChat("patient-401", "What medications am I taking?", "med");
    const conditionMessage = await askChat("patient-400", "Can you explain my condition?", "cond");
    const scaffoldMessage = await askChat("patient-403", "hello", "simple");
    const diagnosisMessage = await askChat("patient-401", "Can you diagnose me with diabetes?", "diag");

    const report = {
      medicationGrounded: medicationMessage.includes("Medication A"),
      conditionLinked: conditionMessage.includes("Condition A"),
      plainLanguageDefault:
        !scaffoldMessage.includes("orchestration") &&
        !scaffoldMessage.includes("propagation") &&
        scaffoldMessage.includes("workflow"),
      clarificationPromptOptional: conditionMessage.includes("Want a shorter, plain-language explanation"),
      diagnosisBoundarySafe:
        diagnosisMessage.includes("cannot diagnose new conditions") &&
        diagnosisMessage.includes("cannot confirm a diagnosis") &&
        !diagnosisMessage.toLowerCase().includes("you have diabetes")
    };

    expect(report.medicationGrounded).toBe(true);
    expect(report.conditionLinked).toBe(true);
    expect(report.plainLanguageDefault).toBe(true);
    expect(report.clarificationPromptOptional).toBe(true);
    expect(report.diagnosisBoundarySafe).toBe(true);
  });
});
