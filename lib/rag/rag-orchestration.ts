/**
 * RAG Orchestration - End-to-End Definition Generation Pipeline
 * 
 * Orchestrates the complete RAG flow:
 * 1. Retrieve sources (RAG retriever)
 * 2. Generate definition (LLM)
 * 3. Apply guardrails (confidence, filtering)
 * 4. Return result or escalate for review
 */

import type { MedicationKnowledge, ConditionKnowledge, RAGRetriever } from "@/lib/showcase/medical-knowledge-base";
import { getRAGRetriever } from "@/lib/rag/rag-retriever";
import { getLLMDefinitionGenerator } from "@/lib/rag/rag-llm-orchestration";
import { getRAGGuardrails } from "@/lib/rag/rag-guardrails";

export type RAGOrchestrationResult<T extends MedicationKnowledge | ConditionKnowledge> = {
  success: boolean;
  definition: T | null;
  confidence: number;
  requiresClinicianReview: boolean;
  reviewReason?: string;
  violations: string[];
  sourceCount: number;
  generationTimeMs: number;
};

export type EscalationEvent = {
  escalationId: string;
  type: "medication" | "condition";
  entityName: string;
  definition: MedicationKnowledge | ConditionKnowledge;
  violationReasons: string[];
  confidence: number;
  escalatedAt: string;
  patientId?: string;
};

/**
 * RAG Orchestration Engine
 * Manages the complete RAG pipeline
 */
export class RAGOrchestrator {
  private retriever: RAGRetriever;
  private generator: Awaited<ReturnType<typeof getLLMDefinitionGenerator>>;
  private guardrails: Awaited<ReturnType<typeof getRAGGuardrails>>;
  private escalationQueue: EscalationEvent[] = [];

  constructor() {
    this.retriever = getRAGRetriever();
    this.generator = getLLMDefinitionGenerator();
    this.guardrails = getRAGGuardrails();
  }

  /**
   * Generate medication definition with full RAG pipeline
   */
  async generateMedicationDefinition(
    medicationName: string,
    patientId?: string
  ): Promise<RAGOrchestrationResult<MedicationKnowledge>> {
    const startTime = Date.now();
    const result: RAGOrchestrationResult<MedicationKnowledge> = {
      success: false,
      definition: null,
      confidence: 0,
      requiresClinicianReview: false,
      violations: [],
      sourceCount: 0,
      generationTimeMs: 0
    };

    try {
      // Step 1: Retrieve sources
      console.info(`[RAG] Starting medication definition pipeline for: ${medicationName}`);
      const sources = await this.retriever.retrieveMedicationSources(medicationName, 5);
      result.sourceCount = sources.length;

      if (sources.length === 0) {
        result.violations.push("No clinical sources found for this medication");
        result.requiresClinicianReview = true;
        result.reviewReason = "no-sources-found";
        return result;
      }

      // Step 2: Validate sources
      const sourceValidation = this.guardrails.validateSources(sources);
      if (!sourceValidation.valid) {
        result.violations.push(`Low source quality: ${sourceValidation.quality.toFixed(2)}`);
        if (sourceValidation.missingAuthority.length > 0) {
          result.violations.push(`Missing authority from: ${sourceValidation.missingAuthority.join(", ")}`);
        }
      }

      // Step 3: Generate definition via LLM
      console.info(`[RAG] Generating medication definition from ${sources.length} sources`);
      const definition = await this.generator.generateMedicationDefinition(medicationName, sources);
      result.definition = definition;
      result.confidence = definition.confidence ?? 0;

      // Step 4: Apply guardrails
      const guardrailCheck = this.guardrails.checkMedicationDefinition(definition, patientId);
      result.violations = guardrailCheck.violations;
      result.requiresClinicianReview = guardrailCheck.requiresReview;
      result.reviewReason = guardrailCheck.reviewReason;

      // Step 5: Determine success
      if (guardrailCheck.passed) {
        result.success = true;
        console.info(
          `[RAG] ✅ Medication definition approved: ${medicationName} (confidence: ${result.confidence.toFixed(2)})`
        );
      } else {
        console.warn(
          `[RAG] ⚠️  Medication definition requires review: ${medicationName} (reason: ${result.reviewReason})`
        );
        // Escalate for clinician review
        this.escalateDefinition({
          escalationId: `med_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          type: "medication",
          entityName: medicationName,
          definition,
          violationReasons: result.violations,
          confidence: result.confidence,
          escalatedAt: new Date().toISOString(),
          patientId
        });
      }

      return result;
    } catch (error) {
      console.error(`[RAG] Error in medication definition pipeline:`, error);
      result.violations.push(`Generation error: ${error instanceof Error ? error.message : "Unknown error"}`);
      result.requiresClinicianReview = true;
      result.reviewReason = "generation-error";
      return result;
    } finally {
      result.generationTimeMs = Date.now() - startTime;
      console.info(`[RAG] Medication pipeline completed in ${result.generationTimeMs}ms`);
    }
  }

  /**
   * Generate condition definition with full RAG pipeline
   */
  async generateConditionDefinition(
    conditionName: string,
    patientId?: string
  ): Promise<RAGOrchestrationResult<ConditionKnowledge>> {
    const startTime = Date.now();
    const result: RAGOrchestrationResult<ConditionKnowledge> = {
      success: false,
      definition: null,
      confidence: 0,
      requiresClinicianReview: false,
      violations: [],
      sourceCount: 0,
      generationTimeMs: 0
    };

    try {
      // Step 1: Retrieve sources
      console.info(`[RAG] Starting condition definition pipeline for: ${conditionName}`);
      const sources = await this.retriever.retrieveConditionSources(conditionName, 5);
      result.sourceCount = sources.length;

      if (sources.length === 0) {
        result.violations.push("No clinical sources found for this condition");
        result.requiresClinicianReview = true;
        result.reviewReason = "no-sources-found";
        return result;
      }

      // Step 2: Validate sources
      const sourceValidation = this.guardrails.validateSources(sources);
      if (!sourceValidation.valid) {
        result.violations.push(`Low source quality: ${sourceValidation.quality.toFixed(2)}`);
        if (sourceValidation.missingAuthority.length > 0) {
          result.violations.push(`Missing authority from: ${sourceValidation.missingAuthority.join(", ")}`);
        }
      }

      // Step 3: Generate definition via LLM
      console.info(`[RAG] Generating condition definition from ${sources.length} sources`);
      const definition = await this.generator.generateConditionDefinition(conditionName, sources);
      result.definition = definition;
      result.confidence = definition.confidence ?? 0;

      // Step 4: Apply guardrails
      const guardrailCheck = this.guardrails.checkConditionDefinition(definition, patientId);
      result.violations = guardrailCheck.violations;
      result.requiresClinicianReview = guardrailCheck.requiresReview;
      result.reviewReason = guardrailCheck.reviewReason;

      // Step 5: Determine success
      if (guardrailCheck.passed) {
        result.success = true;
        console.info(
          `[RAG] ✅ Condition definition approved: ${conditionName} (confidence: ${result.confidence.toFixed(2)})`
        );
      } else {
        console.warn(
          `[RAG] ⚠️  Condition definition requires review: ${conditionName} (reason: ${result.reviewReason})`
        );
        // Escalate for clinician review
        this.escalateDefinition({
          escalationId: `cond_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          type: "condition",
          entityName: conditionName,
          definition,
          violationReasons: result.violations,
          confidence: result.confidence,
          escalatedAt: new Date().toISOString(),
          patientId
        });
      }

      return result;
    } catch (error) {
      console.error(`[RAG] Error in condition definition pipeline:`, error);
      result.violations.push(`Generation error: ${error instanceof Error ? error.message : "Unknown error"}`);
      result.requiresClinicianReview = true;
      result.reviewReason = "generation-error";
      return result;
    } finally {
      result.generationTimeMs = Date.now() - startTime;
      console.info(`[RAG] Condition pipeline completed in ${result.generationTimeMs}ms`);
    }
  }

  /**
   * Escalate definition to clinician review queue
   */
  private escalateDefinition(event: EscalationEvent): void {
    this.escalationQueue.push(event);
    console.warn(`[RAG] Escalated for review: ${event.escalationId}`);
  }

  /**
   * Get pending escalations (for clinician dashboard)
   */
  getEscalationQueue(): EscalationEvent[] {
    return [...this.escalationQueue];
  }

  /**
   * Clinician approves a definition
   */
  approveEscalation(escalationId: string): boolean {
    const index = this.escalationQueue.findIndex(e => e.escalationId === escalationId);
    if (index >= 0) {
      const event = this.escalationQueue.splice(index, 1)[0];
      console.info(`[RAG] Escalation approved by clinician: ${escalationId}`);
      return true;
    }
    return false;
  }

  /**
   * Clinician rejects a definition
   */
  rejectEscalation(escalationId: string): boolean {
    const index = this.escalationQueue.findIndex(e => e.escalationId === escalationId);
    if (index >= 0) {
      this.escalationQueue.splice(index, 1);
      console.info(`[RAG] Escalation rejected by clinician: ${escalationId}`);
      return true;
    }
    return false;
  }
}

// Export singleton instance
let orchestratorInstance: RAGOrchestrator | null = null;

export function getRAGOrchestrator(): RAGOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new RAGOrchestrator();
  }
  return orchestratorInstance;
}
