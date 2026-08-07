import type { NextRequest } from "next/server";
import { apiNotImplemented, apiSuccess } from "@/lib/api-response";
import { AppError, handleRouteError } from "@/lib/errors";
import { resolveChatRequestContext } from "@/lib/chat-request-context";
import { appendConversationTurn, getRecentConversationTurns } from "@/lib/chat-session";
import { appendConversationTurnAudit } from "@/lib/conversation-turn-audit";
import {
  attachCorrelationIdHeader,
  getCorrelationIdFromRequest
} from "@/lib/correlation-id";
import { createLogger } from "@/lib/logger";
import { fetchShowcaseProfileSummary } from "@/lib/showcase/profile-summary";
import { buildMedicationGuidance } from "@/lib/showcase/medication-guidance";
import { buildConditionGuidance } from "@/lib/showcase/condition-guidance";
import { applyPlainLanguageControls } from "@/lib/showcase/plain-language-controls";
import { applyClarificationPrompt, type ClarificationDomain } from "@/lib/showcase/clarification-prompt";
import { buildDiagnosisBoundary } from "@/lib/showcase/diagnosis-boundary";
import { buildCarePlanAppointmentGuidance } from "@/lib/showcase/careplan-appointment-guidance";
import { buildLifestyleGuidance } from "@/lib/showcase/lifestyle-guidance";
import { resolveFollowUpReference } from "@/lib/showcase/reference-resolution";
import { applyResponseConsistencyGuard } from "@/lib/showcase/response-consistency-guard";
import { detectEmergencyTriggers } from "@/lib/showcase/emergency-trigger-engine";
import {
  NO_MODEL_PROVIDER_RESPONSE,
  invokeModelGeneration
} from "@/lib/showcase/llm-orchestration";
import { buildEmergencyEscalationResponse } from "@/lib/showcase/emergency-escalation-template";
import { applyEmergencyMinimizationGuard } from "@/lib/showcase/emergency-minimization-guard";
import {
  persistGuardrailActivationEvent,
  persistGuardrailEvaluationEvent
} from "@/lib/guardrail-audit";
import { buildMedicationBoundary } from "@/lib/showcase/medication-boundary";
import { buildLabInterpretationBoundary } from "@/lib/showcase/lab-interpretation-boundary";
import { applyPostGenerationGuardrail } from "@/lib/showcase/post-generation-guardrail";

type ChatRequestPayload = {
  conversationId: string;
  message: string;
};

async function parseChatRequestPayload(request: NextRequest): Promise<ChatRequestPayload> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new AppError("INVALID_REQUEST_BODY", "Request body must be valid JSON.", 400);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new AppError("INVALID_REQUEST_BODY", "Request body must be a JSON object.", 400);
  }

  const payload = parsed as Record<string, unknown>;
  const allowedKeys = new Set(["conversationId", "message"]);
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new AppError(
        "INVALID_REQUEST_BODY",
        `Unsupported field '${key}' in chat payload.`,
        400
      );
    }
  }

  if (typeof payload.conversationId !== "string") {
    throw new AppError(
      "INVALID_REQUEST_BODY",
      "conversationId is required and must be a string.",
      400
    );
  }

  if (typeof payload.message !== "string" || payload.message.trim().length === 0) {
    throw new AppError("INVALID_REQUEST_BODY", "message is required and must be a non-empty string.", 400);
  }

  return {
    conversationId: payload.conversationId,
    message: payload.message.trim()
  };
}

function routeLogger(request: NextRequest) {
  const correlationId = getCorrelationIdFromRequest(request);
  const log = createLogger({ source: "api.chat", correlationId });
  log.info("api.request.received", {
    method: request.method,
    pathname: request.nextUrl.pathname
  });

  return { correlationId, log };
}

function buildTurnResponseIdentifiers(conversationId: string): {
  userTurnId: string;
  assistantResponseId: string;
} {
  const seed = `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  return {
    userTurnId: `turn_${conversationId}_${seed}`,
    assistantResponseId: `asst_${conversationId}_${seed}`
  };
}

function getFirstOrFallback(values: string[], fallback: string): string {
  return values[0] ?? fallback;
}

function buildGuardrailConstraintResponse(): string {
  return [
    "I can only restate information already present in your active profile.",
    "I cannot add assumptions or provide new clinical details that are not documented yet.",
    "If you want, ask about a listed medication, condition, appointment, or care plan item and I will keep it within those guardrails."
  ].join(" ");
}

function persistGuardrailEvaluation(input: {
  conversationId: string;
  patientId: string;
  contextSnapshotRef: string;
  evaluationName:
    | "emergency_trigger"
    | "diagnosis_boundary"
    | "medication_boundary"
    | "lab_interpretation_boundary"
    | "post_generation_guardrail";
  triggered: boolean;
  reason: string;
  ruleId: string;
  ruleIds: string[];
  matchedExpressions: string[];
  userTurnId: string;
  assistantResponseId: string;
}): void {
  persistGuardrailEvaluationEvent({
    conversationId: input.conversationId,
    patientId: input.patientId,
    contextSnapshotRef: input.contextSnapshotRef,
    evaluationName: input.evaluationName,
    triggered: input.triggered,
    reason: input.reason,
    ruleId: input.ruleId,
    ruleIds: input.ruleIds,
    matchedExpressions: input.matchedExpressions,
    userTurnId: input.userTurnId,
    assistantResponseId: input.assistantResponseId
  });
}

function persistConversationTurnArtifacts(input: {
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
  memoryContext?: Parameters<typeof appendConversationTurn>[0]["memoryContext"];
  contentReferences: {
    userTurnId: string;
    assistantResponseId: string;
  };
}): number {
  appendConversationTurnAudit({
    conversationId: input.conversationId,
    userContentReference: input.contentReferences.userTurnId,
    assistantContentReference: input.contentReferences.assistantResponseId
  });

  return appendConversationTurn({
    conversationId: input.conversationId,
    userMessage: input.userMessage,
    assistantMessage: input.assistantMessage,
    memoryContext: input.memoryContext
  });
}

// Contract: GET /api/chat currently returns 501 until chat orchestration is implemented.
export async function GET(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const response = apiNotImplemented("GET /api/chat");
    log.info("api.request.completed", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      statusCode: response.status
    });

    return attachCorrelationIdHeader(response, correlationId);
  } catch (error) {
    return handleRouteError(error, { correlationId, log });
  }
}

// Contract: POST /api/chat validates conversation context and accepts scaffolded chat turns.
export async function POST(request: NextRequest) {
  const { correlationId, log } = routeLogger(request);

  try {
    const payload = await parseChatRequestPayload(request);
    const context = resolveChatRequestContext(payload.conversationId);
    const recentTurns = getRecentConversationTurns(context.conversationId);
    const referenceResolution = resolveFollowUpReference(payload.message, recentTurns);
    const effectiveMessage = referenceResolution.resolvedMessage ?? payload.message;
    const turnIdentifiers = buildTurnResponseIdentifiers(context.conversationId);
    const emergencyTriggerResult = detectEmergencyTriggers(effectiveMessage);
    const profileSummary = await fetchShowcaseProfileSummary(context.patientId, { delayMs: 0 });
    if (!profileSummary) {
      throw new AppError(
        "PROFILE_SUMMARY_NOT_FOUND",
        "Active patient profile summary could not be loaded for this chat session.",
        409
      );
    }

    if (emergencyTriggerResult.isEmergency) {
      const escalationResponse = buildEmergencyEscalationResponse(emergencyTriggerResult.matches);
      const minimizationGuard = applyEmergencyMinimizationGuard({
        assistantMessage: escalationResponse.assistantMessage,
        template: escalationResponse.template
      });
      const assistantMessage = minimizationGuard.assistantMessage;
      const ruleIds = emergencyTriggerResult.matches.map((match) => match.ruleId);
      const matchedExpressions = emergencyTriggerResult.matches.map((match) => match.matchedExpression);

      persistGuardrailEvaluation({
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        evaluationName: "emergency_trigger",
        triggered: true,
          reason: "emergency_trigger_match",
        ruleId: getFirstOrFallback(ruleIds, "ER-TRIGGER-UNKNOWN"),
        ruleIds: ruleIds.length > 0 ? ruleIds : ["ER-TRIGGER-UNKNOWN"],
        matchedExpressions: matchedExpressions.length > 0 ? matchedExpressions : [payload.message],
        userTurnId: turnIdentifiers.userTurnId,
        assistantResponseId: turnIdentifiers.assistantResponseId
      });

      const activationEvent = persistGuardrailActivationEvent({
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        triggerReason: "emergency_trigger_match",
        ruleId: getFirstOrFallback(ruleIds, "ER-TRIGGER-UNKNOWN"),
        ruleIds: ruleIds.length > 0 ? ruleIds : ["ER-TRIGGER-UNKNOWN"],
        matchedExpressions: matchedExpressions.length > 0 ? matchedExpressions : [payload.message],
        userTurnId: turnIdentifiers.userTurnId,
        assistantResponseId: turnIdentifiers.assistantResponseId
      });

      log.info("chat.orchestration.bypass_decision", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        bypassed: true,
        modelCallSkipped: true,
        reason: "emergency_trigger_match",
        matchedRuleIds: emergencyTriggerResult.matches.map((match) => match.ruleId)
      });

      log.info("chat.emergency_trigger.detected", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        ruleSetVersion: emergencyTriggerResult.ruleSetVersion,
        matches: emergencyTriggerResult.matches
      });

      log.info("chat.emergency_minimization_guard.reviewed", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        ruleSetVersion: minimizationGuard.ruleSetVersion,
        violationDetected: minimizationGuard.violationDetected,
        correctionPath: minimizationGuard.correctionPath,
        matchedRuleIds: minimizationGuard.matchedRuleIds,
        matchedPhrases: minimizationGuard.matchedPhrases
      });

      log.info("chat.guardrail_activation_event.persisted", {
        eventId: activationEvent.eventId,
        eventType: activationEvent.eventType,
        timestamp: activationEvent.timestamp,
        conversationId: activationEvent.conversationId,
        patientId: activationEvent.patientId,
        triggerReason: activationEvent.triggerReason,
        ruleId: activationEvent.ruleId,
        ruleIds: activationEvent.ruleIds,
        userTurnId: activationEvent.userTurnId,
        assistantResponseId: activationEvent.assistantResponseId
      });

      const turnCount = persistConversationTurnArtifacts({
        conversationId: context.conversationId,
        userMessage: payload.message,
        assistantMessage,
        contentReferences: turnIdentifiers,
        memoryContext: {
          domain: "emergency",
          entityReferences: ruleIds,
          confidence: "high"
        }
      });

      const response = apiSuccess({
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        contextSnapshotVersion: context.contextSnapshotVersion,
        requestAccepted: true,
        safety: {
          emergencyTrigger: {
            ruleSetVersion: emergencyTriggerResult.ruleSetVersion,
            matches: emergencyTriggerResult.matches
          },
          emergencyEscalation: {
            templateVersion: escalationResponse.templateVersion,
            templateId: escalationResponse.template.templateId,
            escalationClass: escalationResponse.template.escalationClass,
            headline: escalationResponse.template.headline,
            immediateActions: escalationResponse.template.immediateActions,
            safetyBoundary: escalationResponse.template.safetyBoundary,
            minimizationValidation: {
              ruleSetVersion: minimizationGuard.ruleSetVersion,
              violationDetected: minimizationGuard.violationDetected,
              correctionPath: minimizationGuard.correctionPath,
              matchedRuleIds: minimizationGuard.matchedRuleIds
            }
          },
          guardrailAudit: {
            eventId: activationEvent.eventId,
            eventType: activationEvent.eventType,
            timestamp: activationEvent.timestamp,
            triggerReason: activationEvent.triggerReason,
            ruleId: activationEvent.ruleId,
            ruleIds: activationEvent.ruleIds,
            userTurnId: activationEvent.userTurnId,
            assistantResponseId: activationEvent.assistantResponseId
          }
        },
        turn: {
          userMessage: payload.message,
          assistantMessage,
          userTurnId: turnIdentifiers.userTurnId,
          assistantResponseId: turnIdentifiers.assistantResponseId
        }
      });

      log.info("chat.session.turn.appended", {
        conversationId: context.conversationId,
        turnCount
      });

      log.info("api.request.completed", {
        method: request.method,
        pathname: request.nextUrl.pathname,
        statusCode: response.status
      });

      return attachCorrelationIdHeader(response, correlationId);
    }

    const diagnosisBoundary = buildDiagnosisBoundary(
      effectiveMessage,
      profileSummary,
      context.contextSnapshotRef
    );
    const medicationBoundary = buildMedicationBoundary(
      effectiveMessage,
      profileSummary,
      context.contextSnapshotRef
    );
    const labBoundary = buildLabInterpretationBoundary(
      effectiveMessage,
      context.contextSnapshotRef
    );

    persistGuardrailEvaluation({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      evaluationName: "emergency_trigger",
      triggered: emergencyTriggerResult.isEmergency,
      reason: emergencyTriggerResult.isEmergency
        ? "emergency_trigger_match"
        : "no_emergency_trigger_detected",
      ruleId: getFirstOrFallback(
        emergencyTriggerResult.matches.map((match) => match.ruleId),
        "ER-TRIGGER-UNKNOWN"
      ),
      ruleIds: emergencyTriggerResult.matches.length > 0
        ? emergencyTriggerResult.matches.map((match) => match.ruleId)
        : ["ER-TRIGGER-UNKNOWN"],
      matchedExpressions: emergencyTriggerResult.matches.length > 0
        ? emergencyTriggerResult.matches.map((match) => match.matchedExpression)
        : [effectiveMessage],
      userTurnId: turnIdentifiers.userTurnId,
      assistantResponseId: turnIdentifiers.assistantResponseId
    });

    persistGuardrailEvaluation({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      evaluationName: "diagnosis_boundary",
      triggered: diagnosisBoundary.isDiagnosisIntent,
      reason: diagnosisBoundary.triggerReason ?? "no_diagnosis_intent_detected",
      ruleId: getFirstOrFallback(diagnosisBoundary.matchedRuleIds, "DX-BOUNDARY-UNKNOWN"),
      ruleIds: diagnosisBoundary.matchedRuleIds.length > 0
        ? diagnosisBoundary.matchedRuleIds
        : ["DX-BOUNDARY-UNKNOWN"],
      matchedExpressions: diagnosisBoundary.matchedSignals.length > 0
        ? diagnosisBoundary.matchedSignals
        : [effectiveMessage],
      userTurnId: turnIdentifiers.userTurnId,
      assistantResponseId: turnIdentifiers.assistantResponseId
    });

    persistGuardrailEvaluation({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      evaluationName: "medication_boundary",
      triggered: medicationBoundary.isMedicationBoundary,
      reason: medicationBoundary.triggerReason ?? "no_medication_boundary_detected",
      ruleId: getFirstOrFallback(medicationBoundary.matchedRuleIds, "MED-BOUNDARY-UNKNOWN"),
      ruleIds: medicationBoundary.matchedRuleIds.length > 0
        ? medicationBoundary.matchedRuleIds
        : ["MED-BOUNDARY-UNKNOWN"],
      matchedExpressions: medicationBoundary.matchedRuleIds.length > 0
        ? medicationBoundary.matchedRuleIds
        : [effectiveMessage],
      userTurnId: turnIdentifiers.userTurnId,
      assistantResponseId: turnIdentifiers.assistantResponseId
    });

    persistGuardrailEvaluation({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      evaluationName: "lab_interpretation_boundary",
      triggered: labBoundary.isLabInterpretationIntent,
      reason: labBoundary.triggerReason ?? "no_lab_interpretation_detected",
      ruleId: getFirstOrFallback(labBoundary.matchedRuleIds, "LAB-BOUNDARY-UNKNOWN"),
      ruleIds: labBoundary.matchedRuleIds.length > 0
        ? labBoundary.matchedRuleIds
        : ["LAB-BOUNDARY-UNKNOWN"],
      matchedExpressions: labBoundary.blockedPhrases.length > 0
        ? labBoundary.blockedPhrases
        : [effectiveMessage],
      userTurnId: turnIdentifiers.userTurnId,
      assistantResponseId: turnIdentifiers.assistantResponseId
    });

    if (diagnosisBoundary.isDiagnosisIntent) {
      const assistantMessage = diagnosisBoundary.assistantMessage ??
        "I cannot diagnose conditions in chat.";

      log.info("chat.orchestration.bypass_decision", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        bypassed: true,
        modelCallSkipped: true,
        reason: diagnosisBoundary.triggerReason,
        matchedRuleIds: diagnosisBoundary.matchedRuleIds
      });

      log.info("chat.diagnosis_boundary.routed", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSources: diagnosisBoundary.contextSourceRefs,
        matchedSignals: diagnosisBoundary.matchedSignals,
        matchedRuleIds: diagnosisBoundary.matchedRuleIds,
        ruleSetVersion: diagnosisBoundary.ruleSetVersion,
        templateVersion: diagnosisBoundary.templateVersion,
        templateId: diagnosisBoundary.templateId,
        triggerReason: diagnosisBoundary.triggerReason,
        handoff: diagnosisBoundary.handoff
      });

      const turnCount = persistConversationTurnArtifacts({
        conversationId: context.conversationId,
        userMessage: payload.message,
        assistantMessage,
        contentReferences: turnIdentifiers,
        memoryContext: {
          domain: "diagnosis-boundary",
          entityReferences: diagnosisBoundary.matchedRuleIds,
          confidence: "high"
        }
      });

      const response = apiSuccess({
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        contextSnapshotVersion: context.contextSnapshotVersion,
        requestAccepted: true,
        safety: {
          diagnosisBoundary: {
            ruleSetVersion: diagnosisBoundary.ruleSetVersion,
            templateVersion: diagnosisBoundary.templateVersion,
            templateId: diagnosisBoundary.templateId,
            triggerReason: diagnosisBoundary.triggerReason,
            matchedSignals: diagnosisBoundary.matchedSignals,
            matchedRuleIds: diagnosisBoundary.matchedRuleIds,
            contextSources: diagnosisBoundary.contextSourceRefs,
            handoff: diagnosisBoundary.handoff
          }
        },
        turn: {
          userMessage: payload.message,
          assistantMessage
        }
      });

      log.info("chat.session.turn.appended", {
        conversationId: context.conversationId,
        turnCount
      });

      log.info("api.request.completed", {
        method: request.method,
        pathname: request.nextUrl.pathname,
        statusCode: response.status
      });

      return attachCorrelationIdHeader(response, correlationId);
    }

    if (medicationBoundary.isMedicationBoundary) {
      const assistantMessage =
        medicationBoundary.assistantMessage ??
        "I cannot provide medication treatment directives in chat.";

      log.info("chat.orchestration.bypass_decision", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        bypassed: true,
        modelCallSkipped: true,
        reason: medicationBoundary.triggerReason,
        matchedRuleIds: medicationBoundary.matchedRuleIds
      });

      log.info("chat.medication_boundary.blocked", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        category: medicationBoundary.category,
        ruleSetVersion: medicationBoundary.ruleSetVersion,
        matchedRuleIds: medicationBoundary.matchedRuleIds,
        triggerReason: medicationBoundary.triggerReason,
        contextSources: medicationBoundary.contextSourceRefs
      });

      const turnCount = persistConversationTurnArtifacts({
        conversationId: context.conversationId,
        userMessage: payload.message,
        assistantMessage,
        contentReferences: turnIdentifiers,
        memoryContext: {
          domain: "medication-boundary",
          entityReferences: medicationBoundary.matchedRuleIds,
          confidence: "high"
        }
      });
      const response = apiSuccess({
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        contextSnapshotVersion: context.contextSnapshotVersion,
        requestAccepted: true,
        safety: {
          medicationBoundary: {
            category: medicationBoundary.category,
            ruleSetVersion: medicationBoundary.ruleSetVersion,
            matchedRuleIds: medicationBoundary.matchedRuleIds,
            triggerReason: medicationBoundary.triggerReason,
            contextSources: medicationBoundary.contextSourceRefs,
            handoff: {
              careTeamContactRequired: true,
              guidance:
                "Please contact your care team now before changing, stopping, or switching medication."
            }
          }
        },
        turn: {
          userMessage: payload.message,
          assistantMessage
        }
      });

      log.info("chat.session.turn.appended", {
        conversationId: context.conversationId,
        turnCount
      });

      log.info("api.request.completed", {
        method: request.method,
        pathname: request.nextUrl.pathname,
        statusCode: response.status
      });

      return attachCorrelationIdHeader(response, correlationId);
    }

    if (labBoundary.isLabInterpretationIntent) {
      const assistantMessage =
        labBoundary.assistantMessage ??
        "I cannot interpret lab results in chat.";

      log.info("chat.orchestration.bypass_decision", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        bypassed: true,
        modelCallSkipped: true,
        reason: labBoundary.triggerReason,
        matchedRuleIds: labBoundary.matchedRuleIds
      });

      log.info("chat.lab_interpretation_boundary.blocked", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        ruleSetVersion: labBoundary.ruleSetVersion,
        matchedRuleIds: labBoundary.matchedRuleIds,
        triggerReason: labBoundary.triggerReason,
        contextSources: labBoundary.contextSourceRefs,
        prohibitedPhraseRuleSetVersion: labBoundary.prohibitedPhraseRuleSetVersion,
        blockedPhrases: labBoundary.blockedPhrases,
        correctionPath: labBoundary.correctionPath
      });


      const turnCount = persistConversationTurnArtifacts({
        conversationId: context.conversationId,
        userMessage: payload.message,
        assistantMessage,
        contentReferences: turnIdentifiers,
        memoryContext: {
          domain: "lab-boundary",
          entityReferences: labBoundary.matchedRuleIds,
          confidence: "high"
        }
      });
      const response = apiSuccess({
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSnapshotRef: context.contextSnapshotRef,
        contextSnapshotVersion: context.contextSnapshotVersion,
        requestAccepted: true,
        safety: {
          labBoundary: {
            ruleSetVersion: labBoundary.ruleSetVersion,
            matchedRuleIds: labBoundary.matchedRuleIds,
            triggerReason: labBoundary.triggerReason,
            contextSources: labBoundary.contextSourceRefs,
            prohibitedPhraseRuleSetVersion: labBoundary.prohibitedPhraseRuleSetVersion,
            blockedPhrases: labBoundary.blockedPhrases,
            correctionPath: labBoundary.correctionPath,
            handoff: {
              careTeamContactRequired: true,
              guidance:
                "Please contact your care team for personalized interpretation of your lab report."
            }
          }
        },
        turn: {
          userMessage: payload.message,
          assistantMessage
        }
      });

      log.info("chat.session.turn.appended", {
        conversationId: context.conversationId,
        turnCount
      });

      log.info("api.request.completed", {
        method: request.method,
        pathname: request.nextUrl.pathname,
        statusCode: response.status
      });

      return attachCorrelationIdHeader(response, correlationId);
    }

    log.info("chat.orchestration.bypass_decision", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      bypassed: false,
      modelCallSkipped: false,
      reason: null,
      matchedRuleIds: []
    });

    const modelDraftResponse = await invokeModelGeneration({
      conversationId: context.conversationId,
      patientId: context.patientId,
      message: effectiveMessage
    });
    const resolvedModelDraftResponse =
      modelDraftResponse === NO_MODEL_PROVIDER_RESPONSE || modelDraftResponse.trim().length === 0
        ? null
        : modelDraftResponse;

    const medicationGuidance = buildMedicationGuidance(
      effectiveMessage,
      profileSummary,
      context.contextSnapshotRef
    );

    const conditionGuidance = buildConditionGuidance(
      effectiveMessage,
      profileSummary,
      context.contextSnapshotRef
    );

    const carePlanAppointmentGuidance = buildCarePlanAppointmentGuidance(
      effectiveMessage,
      profileSummary,
      context.contextSnapshotRef
    );

    const lifestyleGuidance = buildLifestyleGuidance(
      effectiveMessage,
      profileSummary,
      context.contextSnapshotRef
    );

    const responseDomain = referenceResolution.fallbackMessage
      ? "general"
      : diagnosisBoundary.isDiagnosisIntent
        ? "diagnosis-boundary"
        : lifestyleGuidance.isLifestyleIntent
          ? "lifestyle"
          : carePlanAppointmentGuidance.intent === "appointment"
            ? "appointment"
            : carePlanAppointmentGuidance.intent === "care-plan" ||
                carePlanAppointmentGuidance.intent === "appointment-care-plan"
              ? "care-plan"
              : conditionGuidance.isConditionIntent
                ? "condition"
                : medicationGuidance.isMedicationIntent
                  ? "medication"
                  : "general";

    const entityReferences = lifestyleGuidance.isLifestyleIntent
      ? [
          ...lifestyleGuidance.usedConditionIds,
          ...lifestyleGuidance.usedMedicationIds,
          ...lifestyleGuidance.usedCareTaskIds,
          ...lifestyleGuidance.usedVisitIds
        ]
      : carePlanAppointmentGuidance.isIntentMatch
        ? [...carePlanAppointmentGuidance.usedVisitIds, ...carePlanAppointmentGuidance.usedCareTaskIds]
        : conditionGuidance.isConditionIntent
          ? conditionGuidance.conditionsUsed.map((condition) => condition.label)
          : medicationGuidance.isMedicationIntent
            ? medicationGuidance.medicationsUsed.map((medication) => medication.name)
            : [];

    const draftAssistantMessage =
      resolvedModelDraftResponse ??
      referenceResolution.fallbackMessage ??
      diagnosisBoundary.assistantMessage ??
      lifestyleGuidance.assistantMessage ??
      carePlanAppointmentGuidance.assistantMessage ??
      conditionGuidance.assistantMessage ??
      medicationGuidance.assistantMessage ??
      buildGuardrailConstraintResponse();

    const postGenerationGuard = applyPostGenerationGuardrail(draftAssistantMessage);

    persistGuardrailEvaluation({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      evaluationName: "post_generation_guardrail",
      triggered: postGenerationGuard.overrideApplied,
      reason: postGenerationGuard.overrideReason ?? "passed",
      ruleId: getFirstOrFallback(postGenerationGuard.matchedRuleIds, "PG-GUARD-000"),
      ruleIds: postGenerationGuard.matchedRuleIds.length > 0
        ? postGenerationGuard.matchedRuleIds
        : ["PG-GUARD-000"],
      matchedExpressions: postGenerationGuard.matchedRuleIds.length > 0
        ? postGenerationGuard.matchedRuleIds
        : [payload.message],
      userTurnId: turnIdentifiers.userTurnId,
      assistantResponseId: turnIdentifiers.assistantResponseId
    });

    const consistencyReview = applyResponseConsistencyGuard({
      draftResponse: postGenerationGuard.finalResponse,
      domain: responseDomain,
      entityReferences,
      recentTurns
    });

    const plainLanguageReview = applyPlainLanguageControls(consistencyReview.finalResponse);
    const clarificationDomain: ClarificationDomain = conditionGuidance.assistantMessage
      ? "condition"
      : medicationGuidance.assistantMessage
        ? "medication"
        : "general";
    const clarificationReview = applyClarificationPrompt({
      responseText: plainLanguageReview.responseText,
      domain: clarificationDomain
    });
    const assistantMessage = clarificationReview.responseText;

    log.info("chat.request.context.resolved", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      contextSnapshotVersion: context.contextSnapshotVersion,
      sessionUpdatedAt: context.sessionUpdatedAt,
      followUpResolved: referenceResolution.confidence === "high",
      followUpResolutionConfidence: referenceResolution.confidence
    });

    if (referenceResolution.confidence !== "none") {
      log.info("chat.reference_resolution.reviewed", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        confidence: referenceResolution.confidence,
        inferredDomain: referenceResolution.inferredDomain,
        sourceTurnOffset: referenceResolution.sourceTurnOffset,
        fallbackApplied: referenceResolution.fallbackMessage !== null
      });
    }

    log.info("chat.response.consistency_guard.reviewed", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      contradictionDetected: consistencyReview.contradictionDetected,
      rewriteApplied: consistencyReview.rewriteApplied,
      fallbackApplied: consistencyReview.fallbackApplied,
      reason: consistencyReview.reason,
      sourceTurnOffset: consistencyReview.sourceTurnOffset
    });

    log.info("chat.post_generation_guardrail.reviewed", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      overrideApplied: postGenerationGuard.overrideApplied,
      violationCategory: postGenerationGuard.violationCategory,
      overrideReason: postGenerationGuard.overrideReason,
      matchedRuleIds: postGenerationGuard.matchedRuleIds
    });

    if (medicationGuidance.isMedicationIntent) {
      log.info("chat.medication.context.grounded", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSources: medicationGuidance.contextSourceRefs,
        activeMedicationCount: medicationGuidance.medicationsUsed.length,
        missingDetailMedicationIds: medicationGuidance.missingDetailMedicationIds
      });
    }

    if (conditionGuidance.isConditionIntent) {
      log.info("chat.condition.context.grounded", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSources: conditionGuidance.contextSourceRefs,
        activeConditionCount: conditionGuidance.conditionsUsed.length,
        unknownRequestedCondition: conditionGuidance.unknownRequestedCondition,
        profileMarkers: conditionGuidance.profileMarkers
      });
    }

    if (diagnosisBoundary.isDiagnosisIntent) {
      log.info("chat.diagnosis.boundary.blocked", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        contextSources: diagnosisBoundary.contextSourceRefs,
        matchedSignals: diagnosisBoundary.matchedSignals
      });
    }

    if (carePlanAppointmentGuidance.isIntentMatch) {
      log.info("chat.careplan_appointment.context.grounded", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        intent: carePlanAppointmentGuidance.intent,
        contextSources: carePlanAppointmentGuidance.contextSourceRefs,
        usedVisitIds: carePlanAppointmentGuidance.usedVisitIds,
        usedCareTaskIds: carePlanAppointmentGuidance.usedCareTaskIds,
        missingScheduleData: carePlanAppointmentGuidance.missingScheduleData,
        missingTaskData: carePlanAppointmentGuidance.missingTaskData
      });
    }

    if (lifestyleGuidance.isLifestyleIntent) {
      log.info("chat.lifestyle.context.grounded", {
        conversationId: context.conversationId,
        patientId: context.patientId,
        intent: lifestyleGuidance.intent,
        isOutOfScope: lifestyleGuidance.isOutOfScope,
        contextSources: lifestyleGuidance.contextSourceRefs,
        usedConditionIds: lifestyleGuidance.usedConditionIds,
        usedMedicationIds: lifestyleGuidance.usedMedicationIds,
        usedCareTaskIds: lifestyleGuidance.usedCareTaskIds,
        usedVisitIds: lifestyleGuidance.usedVisitIds
      });
    }

    log.info("chat.response.readability.reviewed", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      ...plainLanguageReview.readability
    });

    log.info("chat.response.clarification_prompt.reviewed", {
      conversationId: context.conversationId,
      patientId: context.patientId,
      domain: clarificationDomain,
      promptAdded: clarificationReview.promptAdded,
      promptVariant: clarificationReview.promptVariant,
      complexitySignals: clarificationReview.complexitySignals
    });

    const response = apiSuccess({
      conversationId: context.conversationId,
      patientId: context.patientId,
      contextSnapshotRef: context.contextSnapshotRef,
      contextSnapshotVersion: context.contextSnapshotVersion,
      requestAccepted: true,
      safety: postGenerationGuard.overrideApplied
        ? {
            postGenerationGuardrail: {
              overrideApplied: postGenerationGuard.overrideApplied,
              violationCategory: postGenerationGuard.violationCategory,
              overrideReason: postGenerationGuard.overrideReason,
              matchedRuleIds: postGenerationGuard.matchedRuleIds
            }
          }
        : undefined,
      turn: {
        userMessage: payload.message,
        assistantMessage
      }
    });

    const turnCount = persistConversationTurnArtifacts({
      conversationId: context.conversationId,
      userMessage: payload.message,
      assistantMessage,
      contentReferences: turnIdentifiers,
      memoryContext: {
        domain: responseDomain,
        entityReferences,
        confidence: referenceResolution.confidence === "low" ? "low" : "high"
      }
    });

    log.info("chat.session.turn.appended", {
      conversationId: context.conversationId,
      turnCount
    });

    log.info("api.request.completed", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      statusCode: response.status
    });

    return attachCorrelationIdHeader(response, correlationId);
  } catch (error) {
    return handleRouteError(error, { correlationId, log });
  }
}