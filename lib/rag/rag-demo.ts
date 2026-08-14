/**
 * RAG Pipeline Demo & Testing
 * 
 * This file demonstrates the end-to-end RAG flow:
 * 1. Medication definition retrieval & generation
 * 2. Condition definition retrieval & generation
 * 3. Guardrail validation
 * 4. Clinician escalation workflow
 */

import { getRAGOrchestrator } from "@/lib/rag/rag-orchestration";
import type { RAGOrchestrationResult } from "@/lib/rag/rag-orchestration";
import type { MedicationKnowledge, ConditionKnowledge } from "@/lib/showcase/medical-knowledge-base";

/**
 * Example: Get medication definition with RAG
 */
export async function exampleMedicationDefinition() {
  console.log("\n=== RAG Pipeline: Medication Definition Example ===\n");

  const orchestrator = getRAGOrchestrator();
  const medicationName = "Metformin";
  const patientId = "patient_123";

  console.log(`📋 Requesting definition for: ${medicationName}`);

  const result = await orchestrator.generateMedicationDefinition(medicationName, patientId);

  console.log(`\n✅ Generation Status: ${result.success ? "APPROVED" : "REQUIRES REVIEW"}`);
  console.log(`📊 Confidence Score: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`⏱️  Generation Time: ${result.generationTimeMs}ms`);
  console.log(`📚 Sources Used: ${result.sourceCount}`);

  if (result.definition) {
    console.log(`\n📌 Definition:`);
    console.log(`  • Drug Name: ${result.definition.medicationName}`);
    console.log(`  • Drug Class: ${result.definition.drugClass}`);
    console.log(`  • Purpose: ${result.definition.purpose?.substring(0, 80)}...`);
    console.log(`  • Common Side Effects: ${result.definition.commonSideEffects?.join(", ")}`);

    if (result.definition.sources) {
      console.log(`\n🔗 Sources:`);
      result.definition.sources.forEach((source, i) => {
        console.log(`  [${i + 1}] ${source.sourceName} (Score: ${source.relevanceScore})`);
      });
    }
  }

  if (result.requiresClinicianReview) {
    console.log(`\n⚠️  Requires Clinician Review:`);
    console.log(`  Reason: ${result.reviewReason}`);
    console.log(`  Violations: ${result.violations.join("; ")}`);
  }

  return result;
}

/**
 * Example: Get condition definition with RAG
 */
export async function exampleConditionDefinition() {
  console.log("\n=== RAG Pipeline: Condition Definition Example ===\n");

  const orchestrator = getRAGOrchestrator();
  const conditionName = "Type 2 Diabetes";
  const patientId = "patient_456";

  console.log(`📋 Requesting definition for: ${conditionName}`);

  const result = await orchestrator.generateConditionDefinition(conditionName, patientId);

  console.log(`\n✅ Generation Status: ${result.success ? "APPROVED" : "REQUIRES REVIEW"}`);
  console.log(`📊 Confidence Score: ${(result.confidence * 100).toFixed(1)}%`);
  console.log(`⏱️  Generation Time: ${result.generationTimeMs}ms`);
  console.log(`📚 Sources Used: ${result.sourceCount}`);

  if (result.definition) {
    console.log(`\n📌 Definition:`);
    console.log(`  • Medical Name: ${result.definition.medicalName}`);
    console.log(`  • Plain Language: ${result.definition.plainLanguageName}`);
    console.log(`  • What It Means: ${result.definition.whatItMeans?.substring(0, 80)}...`);
    console.log(`  • Why It Matters: ${result.definition.why_it_matters?.substring(0, 80)}...`);

    if (result.definition.whatToMonitor) {
      console.log(`  • What to Monitor: ${result.definition.whatToMonitor.slice(0, 2).join("; ")}`);
    }

    if (result.definition.sources) {
      console.log(`\n🔗 Sources:`);
      result.definition.sources.forEach((source, i) => {
        console.log(`  [${i + 1}] ${source.sourceName} (Score: ${source.relevanceScore})`);
      });
    }
  }

  if (result.requiresClinicianReview) {
    console.log(`\n⚠️  Requires Clinician Review:`);
    console.log(`  Reason: ${result.reviewReason}`);
    console.log(`  Violations: ${result.violations.join("; ")}`);
  }

  return result;
}

/**
 * Example: Clinician review workflow
 */
export async function exampleClinicianReview() {
  console.log("\n=== RAG Pipeline: Clinician Review Example ===\n");

  const orchestrator = getRAGOrchestrator();

  // Generate a definition that might require review
  console.log("📝 Generating definitions that may require review...\n");
  await orchestrator.generateMedicationDefinition("Lisinopril", "patient_789");
  await orchestrator.generateConditionDefinition("Heart Failure", "patient_789");

  // Get escalation queue
  const escalations = orchestrator.getEscalationQueue();
  console.log(`📋 Escalation Queue Length: ${escalations.length}\n`);

  if (escalations.length > 0) {
    console.log(`Pending Escalations:`);
    escalations.forEach((event) => {
      console.log(`\n  ID: ${event.escalationId}`);
      console.log(`  Type: ${event.type.toUpperCase()}`);
      console.log(`  Entity: ${event.entityName}`);
      console.log(`  Confidence: ${(event.confidence * 100).toFixed(1)}%`);
      console.log(`  Reasons: ${event.violationReasons.join("; ")}`);
    });

    // Example: Approve first escalation
    if (escalations.length > 0) {
      const firstId = escalations[0].escalationId;
      console.log(`\n✅ Approving escalation: ${firstId}`);
      orchestrator.approveEscalation(firstId);
      console.log(`   → Escalation approved and removed from queue`);
    }

    // Example: Reject second escalation
    const updatedEscalations = orchestrator.getEscalationQueue();
    if (updatedEscalations.length > 0) {
      const secondId = updatedEscalations[0].escalationId;
      console.log(`\n❌ Rejecting escalation: ${secondId}`);
      orchestrator.rejectEscalation(secondId);
      console.log(`   → Escalation rejected and removed from queue`);
    }

    const finalEscalations = orchestrator.getEscalationQueue();
    console.log(`\n📊 Final Escalation Queue Length: ${finalEscalations.length}`);
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║        RAG PIPELINE DEMO & TESTING                    ║");
  console.log("║  Multi-source medical definition generation with      ║");
  console.log("║  LLM synthesis, confidence scoring & guardrails       ║");
  console.log("╚═══════════════════════════════════════════════════════╝");

  try {
    // Example 1: Medication definition
    const medResult = await exampleMedicationDefinition();

    // Example 2: Condition definition
    const condResult = await exampleConditionDefinition();

    // Example 3: Clinician review workflow
    await exampleClinicianReview();

    console.log("\n╔═══════════════════════════════════════════════════════╗");
    console.log("║        RAG PIPELINE DEMO COMPLETE                    ║");
    console.log("╚═══════════════════════════════════════════════════════╝\n");

    return { medResult, condResult };
  } catch (error) {
    console.error("\n❌ Error during RAG pipeline demo:", error);
    throw error;
  }
}

// For testing: Export as default for Node.js execution
if (typeof module !== "undefined" && require.main === module) {
  runAllExamples().catch(console.error);
}
