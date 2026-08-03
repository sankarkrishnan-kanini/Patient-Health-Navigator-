import { buildDiagnosisBoundary } from "@/lib/showcase/diagnosis-boundary";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const sampleProfile: PatientProfileSummary = {
  profileId: "patient-400",
  patientId: "patient-400",
  activeConditions: [{ conditionId: "c1", label: "Condition A" }],
  activeMedications: [],
  careTasks: [],
  upcomingVisits: []
};

describe("diagnosis boundary", () => {
  it("blocks direct diagnosis-intent prompts", () => {
    const result = buildDiagnosisBoundary(
      "Can you diagnose me with asthma?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );

    expect(result.isDiagnosisIntent).toBe(true);
    expect(result.assistantMessage).toContain("cannot diagnose new conditions");
    expect(result.assistantMessage).toContain("cannot confirm a diagnosis");
    expect(result.assistantMessage).toContain("contact your care team now");
    expect(result.contextSourceRefs).toEqual(["showcase-profile-summary:patient-400"]);
    expect(result.ruleSetVersion).toBe("diagnosis-intent.v1");
    expect(result.templateId).toBe("DX-BOUNDARY-001");
    expect(result.triggerReason).toBe("diagnosis_intent_match");
  });

  it("blocks diagnosis-confirmation prompts", () => {
    const result = buildDiagnosisBoundary(
      "Do I have diabetes?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );

    expect(result.isDiagnosisIntent).toBe(true);
    expect(result.matchedSignals).toContain("self_diagnosis_question");
    expect(result.matchedRuleIds).toContain("DX-RULE-002");
    expect(result.handoff?.careTeamContactRequired).toBe(true);
  });

  it("does not block medication or condition explanation prompts", () => {
    const medication = buildDiagnosisBoundary(
      "What medications am I taking?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );
    const condition = buildDiagnosisBoundary(
      "Can you explain my condition?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );

    expect(medication.isDiagnosisIntent).toBe(false);
    expect(condition.isDiagnosisIntent).toBe(false);
    expect(medication.assistantMessage).toBeNull();
    expect(condition.assistantMessage).toBeNull();
    expect(medication.matchedRuleIds).toEqual([]);
    expect(condition.matchedSignals).toEqual([]);
  });

  it("remains deterministic across diagnosis-intent punctuation and case variations", () => {
    const first = buildDiagnosisBoundary(
      "CAN YOU DIAGNOSE ME?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );
    const second = buildDiagnosisBoundary(
      "Can you diagnose me!!!",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );

    expect(first.isDiagnosisIntent).toBe(true);
    expect(second.isDiagnosisIntent).toBe(true);
    expect(first.templateId).toBe(second.templateId);
    expect(first.assistantMessage).toBe(second.assistantMessage);
  });

  it("does not include a diagnostic conclusion for blocked prompts", () => {
    const result = buildDiagnosisBoundary(
      "Is this diabetes?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );

    expect(result.isDiagnosisIntent).toBe(true);
    expect(result.assistantMessage?.toLowerCase()).not.toContain("you have diabetes");
    expect(result.assistantMessage?.toLowerCase()).not.toContain("you have cancer");
  });
});
