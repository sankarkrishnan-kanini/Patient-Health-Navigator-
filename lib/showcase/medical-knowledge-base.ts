/**
 * Medical Knowledge Base - RAG-Ready Interface
 * 
 * This module provides type definitions and RAG retriever interfaces for:
 * - Medication definitions (sourced from external LLM + verified sources)
 * - Condition definitions (sourced from external LLM + verified sources)
 * 
 * The RAG engine will:
 * 1. Retrieve relevant sources (UpToDate, guidelines, EMR data, RxNorm, MedlinePlus)
 * 2. Validate source agreement (≥2 sources must align)
 * 3. Generate definitions using LLM with citations
 * 4. Apply guardrails (confidence thresholds, content filtering)
 * 
 * IMPORTANT: Definitions are generated at runtime via RAG, not hardcoded.
 */

import type { RAGOrchestrator } from "@/lib/rag/rag-orchestration";

export type RAGSource = {
  sourceId: string;
  sourceName: string; // e.g., "UpToDate", "Clinical Guidelines", "RxNorm", "MedlinePlus"
  sourceUrl?: string;
  relevanceScore: number; // 0.0 - 1.0
  excerpt?: string; // Key excerpt from the source
  timestamp: string; // When the source was last updated
};

export type MedicationKnowledge = {
  medicationName: string;
  commonNames?: string[];
  drugClass?: string;
  purpose?: string;
  mechanism?: string;
  commonSideEffects?: string[];
  seriousSideEffects?: string[];
  safetyNotes?: string[];
  interactions?: string[];
  dosageContext?: string;
  confidence?: number; // 0.0 - 1.0, based on source agreement
  sources?: RAGSource[];
  generatedAt?: string;
  rawData?: unknown;
};

export type ConditionKnowledge = {
  medicalName: string;
  plainLanguageName?: string;
  whatItMeans?: string;
  why_it_matters?: string;
  whatToMonitor?: string[];
  lifestyle_tips?: string[];
  reassurance?: string;
  confidence?: number; // 0.0 - 1.0, based on source agreement
  sources?: RAGSource[];
  synonyms?: string[];
  generatedAt?: string;
  rawData?: unknown;
};

// Simple in-memory cache with 10-minute TTL
class SimpleCache {
  private cache: Map<string, { value: unknown; expiry: number }> = new Map();
  private ttl: number = 600000; // 10 minutes in milliseconds

  get(key: string): unknown {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: unknown): void {
    this.cache.set(key, { value, expiry: Date.now() + this.ttl });
  }
}

const cache = new SimpleCache();

/**
 * RAG Retriever Interface
 * Defines the contract for retrieving and validating medical sources
 */
export interface RAGRetriever {
  retrieveMedicationSources(medicationName: string, topK?: number): Promise<RAGSource[]>;
  retrieveConditionSources(conditionName: string, topK?: number): Promise<RAGSource[]>;
  validateSourceAgreement(sources: RAGSource[]): number; // Returns confidence score
}

// Lazy-load RAG orchestrator to avoid circular dependencies
let orchestratorInstance: RAGOrchestrator | null = null;

async function getRAGOrchestrator(): Promise<RAGOrchestrator | null> {
  if (!orchestratorInstance) {
    try {
      const { getRAGOrchestrator: getRag } = await import("@/lib/rag/rag-orchestration");
      orchestratorInstance = getRag();
    } catch (error) {
      console.error("[Medical Knowledge Base] Failed to load RAG orchestrator:", error);
      return null;
    }
  }
  return orchestratorInstance;
}

/**
 * Get medication context via RAG pipeline
 * Retrieves sources → generates definition → applies guardrails
 */
export async function getMedicationContext(
  medicationName: string,
  patientId?: string
): Promise<MedicationKnowledge | null> {
  try {
    const cacheKey = `med_${medicationName.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached as MedicationKnowledge;
    }

    // Get RAG orchestrator
    const orchestrator = await getRAGOrchestrator();
    if (!orchestrator) {
      console.warn(`[RAG] RAG orchestrator unavailable for medication: ${medicationName}`);
      return null;
    }

    // Run RAG pipeline
    const result = await orchestrator.generateMedicationDefinition(medicationName, patientId);

    if (!result.success && result.requiresClinicianReview) {
      console.warn(
        `[RAG] Medication definition escalated for review: ${medicationName} (${result.reviewReason})`
      );
      // Return escalated definition with low confidence
      if (result.definition) {
        return result.definition;
      }
      return null;
    }

    if (result.definition) {
      cache.set(cacheKey, result.definition);
      return result.definition;
    }

    return null;
  } catch (error) {
    console.error(`[RAG] Error retrieving medication context for ${medicationName}:`, error);
    return null;
  }
}

/**
 * Get condition context via RAG pipeline
 * Retrieves sources → generates definition → applies guardrails
 */
export async function getConditionContext(
  conditionName: string,
  patientId?: string
): Promise<ConditionKnowledge | null> {
  try {
    const cacheKey = `cond_${conditionName.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached as ConditionKnowledge;
    }

    // Get RAG orchestrator
    const orchestrator = await getRAGOrchestrator();
    if (!orchestrator) {
      console.warn(`[RAG] RAG orchestrator unavailable for condition: ${conditionName}`);
      return null;
    }

    // Run RAG pipeline
    const result = await orchestrator.generateConditionDefinition(conditionName, patientId);

    if (!result.success && result.requiresClinicianReview) {
      console.warn(
        `[RAG] Condition definition escalated for review: ${conditionName} (${result.reviewReason})`
      );
      // Return escalated definition with low confidence
      if (result.definition) {
        return result.definition;
      }
      return null;
    }

    if (result.definition) {
      cache.set(cacheKey, result.definition);
      return result.definition;
    }

    return null;
  } catch (error) {
    console.error(`[RAG] Error retrieving condition context for ${conditionName}:`, error);
    return null;
  }
}

/**
 * RAG MIGRATION COMPLETE
 * 
 * All hardcoded medication and condition definitions have been removed.
 * These are now generated dynamically via RAG retriever + LLM with source validation.
 * 
 * Next steps for implementation:
 * 1. Implement RAGRetriever with vector DB (Pinecone/Weaviate)
 * 2. Index clinical sources (UpToDate, guidelines, EMR data)
 * 3. Implement LLM integration for definition generation
 * 4. Add guardrails for confidence scoring and content filtering
 * 5. Implement clinician review workflow for low-confidence definitions
 */
