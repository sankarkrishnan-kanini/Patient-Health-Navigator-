/**
 * RAG Quick Start Guide
 * 
 * Copy-paste examples for common RAG operations
 */

// ============================================================================
// 1. BASIC: Get a medication definition
// ============================================================================

import { getMedicationContext } from "@/lib/showcase/medical-knowledge-base";

async function getMetforminDefinition() {
  const definition = await getMedicationContext("Metformin", "patient_123");
  
  if (definition) {
    console.log(`Drug: ${definition.medicationName}`);
    console.log(`Purpose: ${definition.purpose}`);
    console.log(`Confidence: ${definition.confidence}`);
    console.log(`Sources: ${definition.sources?.map(s => s.sourceName).join(", ")}`);
  }
}

// ============================================================================
// 2. BASIC: Get a condition definition
// ============================================================================

import { getConditionContext } from "@/lib/showcase/medical-knowledge-base";

async function getDiabetesDefinition() {
  const definition = await getConditionContext("Type 2 Diabetes", "patient_456");
  
  if (definition) {
    console.log(`Condition: ${definition.medicalName}`);
    console.log(`What It Means: ${definition.whatItMeans}`);
    console.log(`Confidence: ${definition.confidence}`);
  }
}

// ============================================================================
// 3. ADVANCED: Direct orchestrator access with full control
// ============================================================================

import { getRAGOrchestrator } from "@/lib/rag/rag-orchestration";

async function directOrchestrator() {
  const orchestrator = getRAGOrchestrator();
  
  // Generate medication definition
  const result = await orchestrator.generateMedicationDefinition("Lisinopril", "patient_789");
  
  console.log(`✅ Success: ${result.success}`);
  console.log(`📊 Confidence: ${result.confidence}`);
  console.log(`⏱️  Time: ${result.generationTimeMs}ms`);
  console.log(`📚 Sources: ${result.sourceCount}`);
  
  if (result.requiresClinicianReview) {
    console.log(`⚠️  Requires Review: ${result.reviewReason}`);
    console.log(`   Violations: ${result.violations.join("; ")}`);
  }
  
  return result;
}

// ============================================================================
// 4. ADVANCED: Clinician review workflow
// ============================================================================

import type { EscalationEvent } from "@/lib/rag/rag-orchestration";

async function clinicianReviewWorkflow() {
  const orchestrator = getRAGOrchestrator();
  
  // Generate some definitions (some may require review)
  await orchestrator.generateMedicationDefinition("Metoprolol", "patient_001");
  await orchestrator.generateConditionDefinition("Heart Failure", "patient_001");
  
  // Get pending escalations
  const escalations: EscalationEvent[] = orchestrator.getEscalationQueue();
  
  for (const event of escalations) {
    console.log(`\nPending Review:`);
    console.log(`  ID: ${event.escalationId}`);
    console.log(`  Type: ${event.type}`);
    console.log(`  Entity: ${event.entityName}`);
    console.log(`  Confidence: ${(event.confidence * 100).toFixed(1)}%`);
    console.log(`  Reasons: ${event.violationReasons.join("; ")}`);
    
    // Clinician approves
    if (event.violationReasons[0]?.includes("low-confidence")) {
      console.log(`\n✅ Clinician approves: ${event.escalationId}`);
      orchestrator.approveEscalation(event.escalationId);
    } else {
      console.log(`\n❌ Clinician rejects: ${event.escalationId}`);
      orchestrator.rejectEscalation(event.escalationId);
    }
  }
}

// ============================================================================
// 5. ADVANCED: Custom retriever configuration
// ============================================================================

import { getRAGRetriever } from "@/lib/rag/rag-retriever";

async function customRetrieverConfig() {
  const retriever = getRAGRetriever({
    topK: 3,                    // Get only top 3 sources
    minRelevanceScore: 0.7,     // Higher quality threshold
    sourcePriority: {
      "UpToDate": 1.0,
      "Clinical Guidelines": 0.95,
      "RxNorm": 0.85,
      "MedlinePlus": 0.75,      // Lower than default
      "EMR": 0.5
    }
  });
  
  const sources = await retriever.retrieveMedicationSources("Atorvastatin", 3);
  console.log(`Retrieved ${sources.length} high-quality sources`);
}

// ============================================================================
// 6. ADVANCED: Custom guardrails configuration
// ============================================================================

import { getRAGGuardrails } from "@/lib/rag/rag-guardrails";

async function customGuardrailsConfig() {
  const guardrails = getRAGGuardrails({
    confidenceThreshold: 0.80,      // Stricter threshold
    requireMultipleSources: true,   // Always require ≥2
    enableContentFiltering: true,   // Always filter
    enableRateLimiting: true        // Always rate limit
  });
  
  // Generate definition with complete RAGSource objects
  const definition = {
    medicationName: "TestDrug",
    purpose: "For testing purposes only",
    confidence: 0.72,
    sources: [
      {
        sourceId: "uptod_001",
        sourceName: "UpToDate",
        relevanceScore: 0.85,
        timestamp: new Date().toISOString()
      },
      {
        sourceId: "guide_001",
        sourceName: "Guidelines",
        relevanceScore: 0.78,
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  const check = guardrails.checkMedicationDefinition(definition, "patient_999");
  console.log(`Guardrail check passed: ${check.passed}`);
  
  if (!check.passed) {
    console.log(`Violations: ${check.violations.join("; ")}`);
  }
}

// ============================================================================
// 7. ADVANCED: Custom LLM configuration
// ============================================================================

import { getLLMDefinitionGenerator } from "@/lib/rag/rag-llm-orchestration";

async function customLLMConfig() {
  const generator = getLLMDefinitionGenerator({
    model: "gpt-4",             // Specify model
    maxTokens: 250,             // Shorter responses
    temperature: 0.2            // Even more consistent
  });
  
  // When real LLM API is integrated, this config will be used
  // Currently uses simulated generation with these parameters
}

// ============================================================================
// 8. INTEGRATION: Within chat API route
// ============================================================================

import type { NextRequest } from "next/server";

async function chatRouteIntegration(userMessage: string, patientId: string, _request: NextRequest) {
  // Check if user is asking about a medication
  if (userMessage.toLowerCase().includes("metformin")) {
    // RAG automatically handles this via getMedicationContext
    const definition = await getMedicationContext("Metformin", patientId);
    
    if (definition) {
      return {
        success: true,
        message: `Here's what I found about Metformin:\n\n${definition.purpose}`,
        definition,
        confidence: definition.confidence
      };
    }
  }
  
  // Check if user is asking about a condition
  if (userMessage.toLowerCase().includes("diabetes")) {
    const definition = await getConditionContext("Type 2 Diabetes", patientId);
    
    if (definition) {
      return {
        success: true,
        message: `Here's information about Type 2 Diabetes:\n\n${definition.whatItMeans}`,
        definition,
        confidence: definition.confidence
      };
    }
  }
  
  return { success: false, message: "Definition not found" };
}

// ============================================================================
// 9. MONITORING: Check pipeline performance
// ============================================================================

async function monitorPipelinePerformance() {
  const orchestrator = getRAGOrchestrator();
  
  // Simulate multiple definition requests
  const queries = [
    { type: "medication", name: "Metformin" },
    { type: "medication", name: "Lisinopril" },
    { type: "condition", name: "Type 2 Diabetes" },
    { type: "condition", name: "Hypertension" }
  ];
  
  const results = [];
  
  for (const query of queries) {
    const result =
      query.type === "medication"
        ? await orchestrator.generateMedicationDefinition(query.name, "patient_monitor")
        : await orchestrator.generateConditionDefinition(query.name, "patient_monitor");
    
    results.push({
      query: query.name,
      confidence: result.confidence,
      latency: result.generationTimeMs,
      approved: result.success,
      escalated: result.requiresClinicianReview
    });
  }
  
  // Summary
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const escalationRate = results.filter(r => r.escalated).length / results.length;
  
  console.log(`\n=== Pipeline Performance ===`);
  console.log(`Average Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`Escalation Rate: ${(escalationRate * 100).toFixed(1)}%`);
  console.log(`Approval Rate: ${((1 - escalationRate) * 100).toFixed(1)}%`);
}

// ============================================================================
// 10. TESTING: Run demo pipeline
// ============================================================================

// Command: npx ts-node lib/rag/rag-demo.ts

import { runAllExamples } from "@/lib/rag/rag-demo";

async function runTests() {
  const { medResult, condResult } = await runAllExamples();
  console.log("✅ All RAG pipeline tests completed");
}

// ============================================================================
// EXPORT for external use
// ============================================================================

export {
  getMetforminDefinition,
  getDiabetesDefinition,
  directOrchestrator,
  clinicianReviewWorkflow,
  customRetrieverConfig,
  customGuardrailsConfig,
  customLLMConfig,
  chatRouteIntegration,
  monitorPipelinePerformance,
  runTests
};
