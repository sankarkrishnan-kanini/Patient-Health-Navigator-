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
    expect(result.contextSourceRefs).toEqual(["showcase-profile-summary:patient-400"]);
  });

  it("blocks diagnosis-confirmation prompts", () => {
    const result = buildDiagnosisBoundary(
      "Do I have diabetes?",
      sampleProfile,
      "showcase-profile-summary:patient-400"
    );

    expect(result.isDiagnosisIntent).toBe(true);
    expect(result.matchedSignals).toContain("self_diagnosis_question");
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
  });
});
