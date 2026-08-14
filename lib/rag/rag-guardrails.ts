/**
 * RAG Guardrails - Confidence Scoring & Content Filtering
 * 
 * Implements safety guardrails for medical definitions:
 * - Confidence threshold enforcement
 * - Out-of-scope content filtering
 * - Source validation
 * - Escalation to clinician review
 */

import type { MedicationKnowledge, ConditionKnowledge, RAGSource } from "@/lib/showcase/medical-knowledge-base";

export type GuardrailConfig = {
  confidenceThreshold: number; // Minimum confidence to auto-approve (0.0-1.0)
  requireMultipleSources: boolean; // Require ≥2 sources for approval
  enableContentFiltering: boolean; // Filter out-of-scope claims
  enableRateLimiting: boolean; // Rate-limit per patient
};

export type GuardrailCheckResult = {
  passed: boolean;
  confidence: number;
  violations: string[];
  requiresReview: boolean;
  reviewReason?: string;
};

const DEFAULT_CONFIG: GuardrailConfig = {
  confidenceThreshold: 0.75,
  requireMultipleSources: true,
  enableContentFiltering: true,
  enableRateLimiting: true
};

/**
 * Out-of-scope content patterns (medical claims that require clinician review)
 */
const OUT_OF_SCOPE_MEDICATION_PATTERNS = [
  /cure|cures|curing/i,
  /prevent|prevents|prevention/i,
  /treat|treats|treatment/i,
  /diagnosis|diagnose/i,
  /safe for.*pregnant/i,
  /safe for.*children/i,
  /overdose|toxicity/i
];

const OUT_OF_SCOPE_CONDITION_PATTERNS = [
  /terminal|fatal/i,
  /life expectancy/i,
  /prognosis/i,
  /untreatable/i,
  /contagious|transmissible/i
];

/**
 * RAG Guardrails Engine
 */
export class RAGGuardrails {
  private config: GuardrailConfig;
  private patientQueryLog: Map<string, { timestamp: number; count: number }> = new Map();

  constructor(config: Partial<GuardrailConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate medication definition against guardrails
   */
  checkMedicationDefinition(
    definition: MedicationKnowledge,
    patientId?: string
  ): GuardrailCheckResult {
    const violations: string[] = [];
    let requiresReview = false;
    let reviewReason: string | undefined;

    // Check 1: Confidence threshold
    const confidence = definition.confidence ?? 0.5;
    if (confidence < this.config.confidenceThreshold) {
      violations.push(`Low confidence: ${confidence.toFixed(2)} < ${this.config.confidenceThreshold}`);
      requiresReview = true;
      reviewReason = "low-confidence";
    }

    // Check 2: Multiple sources required
    if (this.config.requireMultipleSources) {
      const sourceCount = definition.sources?.length ?? 0;
      if (sourceCount < 2) {
        violations.push(`Insufficient sources: ${sourceCount} < 2`);
        requiresReview = true;
        if (!reviewReason) reviewReason = "insufficient-sources";
      }
    }

    // Check 3: Content filtering
    if (this.config.enableContentFiltering) {
      const contentViolations = this.filterMedicationContent(definition);
      if (contentViolations.length > 0) {
        violations.push(...contentViolations);
        requiresReview = true;
        if (!reviewReason) reviewReason = "out-of-scope-content";
      }
    }

    // Check 4: Rate limiting
    if (this.config.enableRateLimiting && patientId) {
      const rateLimitViolation = this.checkRateLimit(patientId);
      if (rateLimitViolation) {
        violations.push(rateLimitViolation);
        requiresReview = true;
        if (!reviewReason) reviewReason = "rate-limit-exceeded";
      }
    }

    return {
      passed: violations.length === 0 && !requiresReview,
      confidence,
      violations,
      requiresReview,
      reviewReason
    };
  }

  /**
   * Validate condition definition against guardrails
   */
  checkConditionDefinition(
    definition: ConditionKnowledge,
    patientId?: string
  ): GuardrailCheckResult {
    const violations: string[] = [];
    let requiresReview = false;
    let reviewReason: string | undefined;

    // Check 1: Confidence threshold
    const confidence = definition.confidence ?? 0.5;
    if (confidence < this.config.confidenceThreshold) {
      violations.push(`Low confidence: ${confidence.toFixed(2)} < ${this.config.confidenceThreshold}`);
      requiresReview = true;
      reviewReason = "low-confidence";
    }

    // Check 2: Multiple sources required
    if (this.config.requireMultipleSources) {
      const sourceCount = definition.sources?.length ?? 0;
      if (sourceCount < 2) {
        violations.push(`Insufficient sources: ${sourceCount} < 2`);
        requiresReview = true;
        if (!reviewReason) reviewReason = "insufficient-sources";
      }
    }

    // Check 3: Content filtering
    if (this.config.enableContentFiltering) {
      const contentViolations = this.filterConditionContent(definition);
      if (contentViolations.length > 0) {
        violations.push(...contentViolations);
        requiresReview = true;
        if (!reviewReason) reviewReason = "out-of-scope-content";
      }
    }

    // Check 4: Rate limiting
    if (this.config.enableRateLimiting && patientId) {
      const rateLimitViolation = this.checkRateLimit(patientId);
      if (rateLimitViolation) {
        violations.push(rateLimitViolation);
        requiresReview = true;
        if (!reviewReason) reviewReason = "rate-limit-exceeded";
      }
    }

    return {
      passed: violations.length === 0 && !requiresReview,
      confidence,
      violations,
      requiresReview,
      reviewReason
    };
  }

  /**
   * Filter medication content for out-of-scope claims
   */
  private filterMedicationContent(definition: MedicationKnowledge): string[] {
    const violations: string[] = [];
    const textToCheck = [
      definition.purpose,
      definition.mechanism,
      definition.drugClass,
      ...(definition.commonSideEffects ?? []),
      ...(definition.safetyNotes ?? [])
    ]
      .filter(Boolean)
      .join(" ");

    for (const pattern of OUT_OF_SCOPE_MEDICATION_PATTERNS) {
      if (pattern.test(textToCheck)) {
        violations.push(`Out-of-scope claim detected: ${pattern.source}`);
      }
    }

    return violations;
  }

  /**
   * Filter condition content for out-of-scope claims
   */
  private filterConditionContent(definition: ConditionKnowledge): string[] {
    const violations: string[] = [];
    const textToCheck = [
      definition.whatItMeans,
      definition.why_it_matters,
      definition.reassurance,
      ...(definition.whatToMonitor ?? []),
      ...(definition.lifestyle_tips ?? [])
    ]
      .filter(Boolean)
      .join(" ");

    for (const pattern of OUT_OF_SCOPE_CONDITION_PATTERNS) {
      if (pattern.test(textToCheck)) {
        violations.push(`Out-of-scope claim detected: ${pattern.source}`);
      }
    }

    return violations;
  }

  /**
   * Rate limiting: Allow max 5 definition requests per hour per patient
   */
  private checkRateLimit(patientId: string, maxQueriesPerHour: number = 5): string | null {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const log = this.patientQueryLog.get(patientId);
    if (!log) {
      this.patientQueryLog.set(patientId, { timestamp: now, count: 1 });
      return null;
    }

    // Reset if older than 1 hour
    if (log.timestamp < oneHourAgo) {
      this.patientQueryLog.set(patientId, { timestamp: now, count: 1 });
      return null;
    }

    // Increment count
    log.count += 1;
    if (log.count > maxQueriesPerHour) {
      return `Rate limit exceeded: ${log.count} queries in last hour (max: ${maxQueriesPerHour})`;
    }

    return null;
  }

  /**
   * Validate source quality and authority
   */
  validateSources(sources: RAGSource[]): {
    valid: boolean;
    quality: number; // 0.0-1.0
    missingAuthority: string[];
  } {
    if (sources.length === 0) {
      return { valid: false, quality: 0, missingAuthority: ["No sources provided"] };
    }

    const authorityLevels: Record<string, number> = {
      "UpToDate": 1.0,
      "Clinical Guidelines": 0.95,
      "RxNorm": 0.85,
      "MedlinePlus": 0.8,
      "EMR": 0.75,
      "Other": 0.5
    };

    const quality = sources.reduce((sum, s) => {
      const authority = authorityLevels[s.sourceName] ?? authorityLevels["Other"];
      return sum + authority * (s.relevanceScore ?? 0.5);
    }, 0) / sources.length;

    const missingAuthority = sources
      .filter(s => (authorityLevels[s.sourceName] ?? 0.5) < 0.75)
      .map(s => s.sourceName);

    return {
      valid: quality >= 0.7,
      quality,
      missingAuthority
    };
  }
}

// Export singleton instance
let guardrailsInstance: RAGGuardrails | null = null;

export function getRAGGuardrails(config?: Partial<GuardrailConfig>): RAGGuardrails {
  if (!guardrailsInstance) {
    guardrailsInstance = new RAGGuardrails(config);
  }
  return guardrailsInstance;
}
