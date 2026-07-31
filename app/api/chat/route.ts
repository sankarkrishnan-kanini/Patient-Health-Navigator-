import type { NextRequest } from "next/server";
import { apiNotImplemented, apiSuccess } from "@/lib/api-response";
import { AppError, handleRouteError } from "@/lib/errors";
import { resolveChatRequestContext } from "@/lib/chat-request-context";
import { appendConversationTurn, getRecentConversationTurns } from "@/lib/chat-session";
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
    const profileSummary = await fetchShowcaseProfileSummary(context.patientId, { delayMs: 0 });
    if (!profileSummary) {
      throw new AppError(
        "PROFILE_SUMMARY_NOT_FOUND",
        "Active patient profile summary could not be loaded for this chat session.",
        409
      );
    }

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

    const diagnosisBoundary = buildDiagnosisBoundary(
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
      referenceResolution.fallbackMessage ??
      diagnosisBoundary.assistantMessage ??
      lifestyleGuidance.assistantMessage ??
      carePlanAppointmentGuidance.assistantMessage ??
      conditionGuidance.assistantMessage ??
      medicationGuidance.assistantMessage ??
      "Chat orchestration is scaffolded. Session and patient context propagation is active.";

    const consistencyReview = applyResponseConsistencyGuard({
      draftResponse: draftAssistantMessage,
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
      turn: {
        userMessage: payload.message,
        assistantMessage
      }
    });

    const turnCount = appendConversationTurn({
      conversationId: context.conversationId,
      userMessage: payload.message,
      assistantMessage,
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