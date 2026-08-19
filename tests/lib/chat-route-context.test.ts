import { NextRequest } from "next/server";
import { POST as POST_CHAT } from "@/app/api/chat/route";
import { POST as POST_SESSION } from "@/app/api/chat/session/route";
import { POST as POST_RESET } from "@/app/api/chat/session/reset/route";
import { CORRELATION_ID_HEADER } from "@/lib/correlation-id";
import {
  getConversationTurnAuditCount,
  getConversationTurnAuditEntries,
  resetConversationTurnAuditStoreForTests
} from "@/lib/conversation-turn-audit";
import * as llmOrchestration from "@/lib/showcase/llm-orchestration";
import * as emergencyEscalationTemplate from "@/lib/showcase/emergency-escalation-template";
import {
  appendConversationTurn,
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
    resetConversationTurnAuditStoreForTests();
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
    expect(body.data.turn.assistantMessage).toContain("Medication A");
    expect(body.data.turn.assistantMessage).toContain("Blood sugar management");
    expect(getConversationTurnAuditCount(startedBody.data.conversationId)).toBe(2);

    const auditEntries = getConversationTurnAuditEntries(startedBody.data.conversationId);
    expect(auditEntries.map((entry) => entry.role)).toEqual(["user", "assistant"]);
    expect(auditEntries[0].conversationId).toBe(startedBody.data.conversationId);
    expect(auditEntries[0].contentReference).toContain("turn_");
    expect(auditEntries[1].contentReference).toContain("asst_");
  });

  it("returns a guardrail constraint response when no model text is available", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
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
          message: "hello"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("active profile");
    expect(body.data.turn.assistantMessage).toContain("cannot add assumptions");
    expect(body.data.turn.assistantMessage).toContain("listed medication, condition, appointment, or care plan item");
    expect(body.data.turn.assistantMessage).not.toContain("scaffolded");
    expect(body.data.turn.assistantMessage).not.toContain("orchestration");
  });

  it("returns safe medication fallback when profile details are missing", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-402" },
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
          message: "What meds should I take today?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("Medication B");
    expect(body.data.turn.assistantMessage).toContain("purpose not recorded");
    expect(body.data.turn.assistantMessage).toContain("cannot add assumptions");
    expect(body.data.turn.assistantMessage).toContain("Want me to explain one medication");
    expect(body.data.turn.assistantMessage).not.toContain("cannot diagnose new conditions");
  });

  it("returns profile-linked plain-language condition explanations", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-400" },
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
          message: "Can you explain my condition?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("Condition A");
    expect(body.data.turn.assistantMessage).toContain("plain language");
    expect(body.data.turn.assistantMessage).toContain("active profile for patient-400");
    expect(body.data.turn.assistantMessage).toContain(
      "Want a shorter, plain-language explanation for one condition?"
    );
    expect(body.data.turn.assistantMessage).not.toContain("cannot diagnose new conditions");
  });

  it("routes symptom-only prompts to profile condition guidance", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-400" },
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
          message: "Fever"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("Condition A");
    expect(body.data.turn.assistantMessage).toContain("active profile for patient-400");
    expect(body.data.turn.assistantMessage).not.toContain("scaffolded");
  });

  it("routes diagnosis-intent prompts to a consistent safe boundary response", async () => {
    const modelInvocationSpy = vi.spyOn(llmOrchestration, "invokeModelGeneration");

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
          message: "Can you diagnose me with diabetes?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot diagnose new conditions");
    expect(body.data.turn.assistantMessage).toContain("cannot confirm a diagnosis");
    expect(body.data.turn.assistantMessage).toContain("contact your care team now");
    expect(body.data.turn.assistantMessage).not.toContain("Medication A");
    expect(body.data.turn.assistantMessage).not.toContain("you have diabetes");
    expect(body.data.safety.diagnosisBoundary).toEqual({
      ruleSetVersion: "diagnosis-intent.v1",
      templateVersion: "diagnosis-boundary-template.v1",
      templateId: "DX-BOUNDARY-001",
      triggerReason: "diagnosis_intent_match",
      matchedSignals: ["diagnosis_keyword"],
      matchedRuleIds: ["DX-RULE-001"],
      contextSources: ["showcase-profile-summary:patient-401"],
      handoff: {
        careTeamContactRequired: true,
        escalationGuidance:
          "For severe or rapidly worsening symptoms, seek urgent in-person care or emergency services immediately."
      }
    });
    expect(modelInvocationSpy).not.toHaveBeenCalled();
  });

  it("blocks dosage-change medication directives with deterministic refusal routing", async () => {
    const modelInvocationSpy = vi.spyOn(llmOrchestration, "invokeModelGeneration");

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
          message: "Can I increase my dose tonight?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot provide dosage change instructions");
    expect(body.data.turn.assistantMessage).toContain("contact your care team now");
    expect(body.data.safety.medicationBoundary).toEqual({
      category: "dosage-change",
      ruleSetVersion: "medication-boundary.v1",
      matchedRuleIds: ["MED-BOUNDARY-DOSE-001"],
      triggerReason: "medication_dose_or_stop_request",
      contextSources: ["showcase-profile-summary:patient-401"],
      handoff: {
        careTeamContactRequired: true,
        guidance:
          "Please contact your care team now before changing, stopping, or switching medication."
      }
    });
    expect(modelInvocationSpy).not.toHaveBeenCalled();
  });

  it("blocks medication-stop directives with deterministic refusal routing", async () => {
    const modelInvocationSpy = vi.spyOn(llmOrchestration, "invokeModelGeneration");

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
          message: "Should I stop taking Medication A?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot advise stopping or switching medication");
    expect(body.data.turn.assistantMessage).not.toContain("stop medication now");
    expect(body.data.safety.medicationBoundary.category).toBe("stop-change");
    expect(body.data.safety.medicationBoundary.matchedRuleIds).toEqual(["MED-BOUNDARY-STOP-001"]);
    expect(modelInvocationSpy).not.toHaveBeenCalled();
  });

  it("blocks lab interpretation prompts with care-team redirection and no clinical judgment", async () => {
    const modelInvocationSpy = vi.spyOn(llmOrchestration, "invokeModelGeneration");

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
          message: "Are my lab results normal?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot interpret lab results");
    expect(body.data.turn.assistantMessage).toContain("contact your care team");
    expect(body.data.turn.assistantMessage.toLowerCase()).not.toContain("normal");
    expect(body.data.turn.assistantMessage.toLowerCase()).not.toContain("abnormal");
    expect(body.data.safety.labBoundary).toEqual({
      ruleSetVersion: "lab-boundary.v1",
      matchedRuleIds: ["LAB-BOUNDARY-001"],
      triggerReason: "lab_interpretation_request",
      contextSources: ["showcase-profile-summary:patient-401"],
      prohibitedPhraseRuleSetVersion: "lab-judgment-phrases.v1",
      blockedPhrases: [],
      correctionPath: "none",
      handoff: {
        careTeamContactRequired: true,
        guidance:
          "Please contact your care team for personalized interpretation of your lab report."
      }
    });
    expect(modelInvocationSpy).not.toHaveBeenCalled();
  });

  it("intercepts emergency symptom prompts with trigger metadata and urgent boundary response", async () => {
    const modelInvocationSpy = vi.spyOn(llmOrchestration, "invokeModelGeneration");

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
          message: "I have CHEST-PAIN and trouble breathing right now"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("Possible emergency symptoms detected");
    expect(body.data.turn.assistantMessage).toContain("Call emergency services now");
    expect(body.data.turn.assistantMessage).toContain("immediately");
    expect(body.data.turn.assistantMessage).toContain("cannot safely triage emergency symptoms in chat");
    expect(body.data.safety.emergencyTrigger.ruleSetVersion).toBe("emergency-triggers.v1");
    expect(body.data.safety.emergencyTrigger.matches).toEqual([
      {
        ruleId: "ER-CHEST-PAIN-001",
        triggerLabel: "chest-pain",
        matchedExpression: "chest pain"
      },
      {
        ruleId: "ER-BREATHING-001",
        triggerLabel: "breathing-difficulty",
        matchedExpression: "trouble breathing"
      }
    ]);
    expect(body.data.safety.emergencyEscalation).toEqual({
      templateVersion: "emergency-escalation.v1",
      templateId: "ESC-MULTI-SYMPTOM-001",
      escalationClass: "multi-symptom",
      headline: "Possible emergency symptoms detected: chest pain and breathing difficulty.",
      immediateActions: [
        "Call emergency services now.",
        "Go to the nearest emergency department immediately."
      ],
      safetyBoundary: "I cannot safely triage emergency symptoms in chat.",
      emergencyContacts: [
        {
          label: "National Emergency",
          number: "112",
          description: "National emergency response"
        },
        {
          label: "Ambulance Service",
          number: "108",
          description: "Emergency ambulance service"
        }
      ],
      minimizationValidation: {
        ruleSetVersion: "emergency-minimization.v1",
        violationDetected: false,
        correctionPath: "none",
        matchedRuleIds: []
      }
    });
    expect(body.data.turn.assistantMessage).not.toContain("Medication A");
    expect(modelInvocationSpy).not.toHaveBeenCalled();
  });

  it("invokes normal model generation orchestration when no emergency trigger is matched", async () => {
    const modelInvocationSpy = vi.spyOn(llmOrchestration, "invokeModelGeneration");

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
          message: "Summarize my medications"
        },
        "cid-chat"
      )
    );

    expect(response.status).toBe(200);
    expect(modelInvocationSpy).toHaveBeenCalledTimes(1);
  });

  it("returns the local appointment booking action for explicit booking requests", async () => {
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
          message: "I need to book an appointment"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.appointmentBookingAction).toEqual({
      label: "Book an Appointment",
      href: "http://localhost:3000"
    });
  });

  it("post-generation guard overrides diagnosis-violating model draft", async () => {
    vi.spyOn(llmOrchestration, "invokeModelGeneration").mockReturnValue(
      "You have diabetes based on this symptom pattern."
    );

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
          message: "hello"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot diagnose conditions");
    expect(body.data.safety.postGenerationGuardrail).toEqual({
      overrideApplied: true,
      violationCategory: "diagnosis",
      overrideReason: "prohibited_advice_detected",
      matchedRuleIds: ["PG-DIAGNOSIS-001"]
    });
  });

  it("post-generation guard overrides medication-violating model draft", async () => {
    vi.spyOn(llmOrchestration, "invokeModelGeneration").mockReturnValue(
      "You should increase your dose and stop taking Medication A today."
    );

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
          message: "hello"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot provide medication dose changes");
    expect(body.data.safety.postGenerationGuardrail.violationCategory).toBe("medication");
    expect(body.data.safety.postGenerationGuardrail.matchedRuleIds).toEqual(["PG-MEDICATION-001"]);
  });

  it("post-generation guard overrides lab-judgment model draft", async () => {
    vi.spyOn(llmOrchestration, "invokeModelGeneration").mockReturnValue(
      "Your lab results are normal and in a safe range."
    );

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
          message: "hello"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("cannot interpret lab results");
    expect(body.data.safety.postGenerationGuardrail.violationCategory).toBe("lab");
    expect(body.data.safety.postGenerationGuardrail.matchedRuleIds).toEqual(["PG-LAB-001"]);
  });

  it("filters minimization language from emergency path using deterministic rewrite", async () => {
    vi.spyOn(emergencyEscalationTemplate, "buildEmergencyEscalationResponse").mockReturnValue({
      templateVersion: "emergency-escalation.v1",
      template: {
        templateId: "ESC-MULTI-SYMPTOM-001",
        escalationClass: "multi-symptom",
        headline: "Possible emergency symptoms detected: chest pain and breathing difficulty.",
        immediateActions: [
          "Call emergency services now.",
          "Go to the nearest emergency department immediately."
        ],
        safetyBoundary: "I cannot safely triage emergency symptoms in chat."
      },
      assistantMessage:
        "This is probably fine. Call emergency services now. You can just monitor for now."
    });

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
          message: "I have chest pain"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("Possible emergency symptoms detected");
    expect(body.data.turn.assistantMessage).not.toContain("probably fine");
    expect(body.data.turn.assistantMessage).not.toContain("just monitor");
    expect(body.data.safety.emergencyEscalation.minimizationValidation).toEqual({
      ruleSetVersion: "emergency-minimization.v1",
      violationDetected: true,
      correctionPath: "rewrite_template",
      matchedRuleIds: ["MIN-002", "MIN-004"]
    });
  });

  it("returns appointment-grounded response with active profile schedule data", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
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
          message: "When is my next appointment?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("upcoming visit details");
    expect(body.data.turn.assistantMessage).toContain("2099-01-01T00:00:00Z");
  });

  it("keeps appointment-grounded outputs deterministic across repeated prompts", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const first = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "When is my next appointment?"
        },
        "cid-chat-1"
      )
    );
    const firstBody = await first.json();

    const second = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "When is my next appointment?"
        },
        "cid-chat-2"
      )
    );
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.data.turn.assistantMessage).toBe(secondBody.data.turn.assistantMessage);
  });

  it("returns care-plan grounded response with active tasks", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-402" },
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
          message: "What is in my care plan?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("care plan tasks");
    expect(body.data.turn.assistantMessage).toContain("Annual wellness follow-up");
  });

  it("returns lifestyle guidance grounded to profile context", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-402" },
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
          message: "What should I eat?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("Medication B");
    expect(body.data.turn.assistantMessage).toContain("Twice daily with meals");
    expect(body.data.turn.assistantMessage).toContain("Annual wellness follow-up");
  });

  it("returns safe boundary for out-of-scope lifestyle requests", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-402" },
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
          message: "Build me an exact 7-day meal plan with macro targets."
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain(
      "cannot create a personalized medical diet or exercise prescription"
    );
  });

  it("keeps lifestyle guidance deterministic across repeated prompts", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-402" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const first = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "What should I eat?"
        },
        "cid-chat-1"
      )
    );
    const firstBody = await first.json();

    const second = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "What should I eat?"
        },
        "cid-chat-2"
      )
    );
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.data.turn.assistantMessage).toBe(secondBody.data.turn.assistantMessage);
  });

  it("resolves shorthand follow-up references from prior appointment turn", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const first = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "When is my next appointment?"
        },
        "cid-chat-1"
      )
    );
    const firstBody = await first.json();

    const followUp = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "When is it?"
        },
        "cid-chat-2"
      )
    );
    const followUpBody = await followUp.json();

    expect(first.status).toBe(200);
    expect(followUp.status).toBe(200);
    expect(followUpBody.data.turn.assistantMessage).toContain("2099-01-01T00:00:00Z");
    expect(followUpBody.data.turn.assistantMessage).toBe(firstBody.data.turn.assistantMessage);
  });

  it("returns a fallback prompt when shorthand resolution confidence is low", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-405" },
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
          message: "What about that?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("I want to make sure I follow you");
    expect(body.data.turn.assistantMessage).toContain("medication, condition, appointment, care plan, or lifestyle routine");
  });

  it("stays coherent across six exchanges in the same bound session", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const prompts = [
      "When is my next appointment?",
      "When is it?",
      "What is in my care plan?",
      "What about that?",
      "When is it?",
      "What about that?"
    ];

    const responses: string[] = [];
    for (let index = 0; index < prompts.length; index += 1) {
      const response = await POST_CHAT(
        buildJsonRequest(
          "http://localhost:3030/api/chat",
          "POST",
          {
            conversationId: startedBody.data.conversationId,
            message: prompts[index]
          },
          `cid-chat-${index}`
        )
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      responses.push(body.data.turn.assistantMessage);
    }

    expect(responses[0]).toContain("2099-01-01T00:00:00Z");
    expect(responses[1]).toContain("2099-01-01T00:00:00Z");
    expect(responses[2]).toContain("Review blood pressure trend");
    expect(responses[3]).toContain("Review blood pressure trend");
    expect(responses[4]).toContain("Review blood pressure trend");
    expect(responses[5]).toContain("Review blood pressure trend");
  });

  it("rewrites contradictory appointment responses using recent in-session history", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    appendConversationTurn({
      conversationId: startedBody.data.conversationId,
      userMessage: "Do I have upcoming visits?",
      assistantMessage:
        "I checked your active profile and there are no upcoming visits listed right now. If this seems out of date, please confirm your profile or check with your care team.",
      memoryContext: {
        domain: "appointment",
        entityReferences: [],
        confidence: "high"
      }
    });

    const response = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "When is my next appointment?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("no upcoming visits listed");
    expect(body.data.turn.assistantMessage).not.toContain("2099-01-01T00:00:00Z");
  });

  it("uses safe fallback when contradiction is detected but consistency cannot be guaranteed", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-403" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    appendConversationTurn({
      conversationId: startedBody.data.conversationId,
      userMessage: "Do I have upcoming visits?",
      assistantMessage:
        "I checked your active profile and there are no upcoming visits listed right now. If this seems out of date, please confirm your profile or check with your care team.",
      memoryContext: {
        domain: "appointment",
        entityReferences: [],
        confidence: "low"
      }
    });

    const response = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "When is my next appointment?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("I may be mixing details from earlier messages");
  });

  it("returns appointment fallback when schedule data is missing", async () => {
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
          message: "Do I have any upcoming appointments?"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("no upcoming visits listed");
  });

  it("returns condition boundary messaging for unknown condition requests", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-400" },
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
          message: "Explain asthma"
        },
        "cid-chat"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.turn.assistantMessage).toContain("do not see 'asthma'");
    expect(body.data.turn.assistantMessage).toContain("cannot confirm or diagnose new conditions");
  });

  it("keeps condition explanations consistent across repeated prompts", async () => {
    const started = await POST_SESSION(
      buildJsonRequest(
        "http://localhost:3030/api/chat/session",
        "POST",
        { selectedPatientId: "patient-400" },
        "cid-start"
      )
    );
    const startedBody = await started.json();

    const first = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "Can you explain my condition?"
        },
        "cid-chat-1"
      )
    );
    const firstBody = await first.json();

    const second = await POST_CHAT(
      buildJsonRequest(
        "http://localhost:3030/api/chat",
        "POST",
        {
          conversationId: startedBody.data.conversationId,
          message: "Can you explain my condition?"
        },
        "cid-chat-2"
      )
    );
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(firstBody.data.turn.assistantMessage).toBe(secondBody.data.turn.assistantMessage);
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