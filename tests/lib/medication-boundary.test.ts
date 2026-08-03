import { buildMedicationBoundary } from "@/lib/showcase/medication-boundary";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const sampleProfile: PatientProfileSummary = {
  profileId: "patient-401",
  patientId: "patient-401",
  activeConditions: [],
  activeMedications: [
    {
      medicationId: "med-1",
      name: "Medication A",
      schedule: "Every morning",
      purpose: "Blood sugar management"
    }
  ],
  careTasks: [],
  upcomingVisits: []
};

describe("medication boundary", () => {
  it("blocks dosage-change directives with refusal and care-team handoff", () => {
    const result = buildMedicationBoundary(
      "Can I increase my dose tonight?",
      sampleProfile,
      "showcase-profile-summary:patient-401"
    );

    expect(result.isMedicationBoundary).toBe(true);
    expect(result.category).toBe("dosage-change");
    expect(result.matchedRuleIds).toContain("MED-BOUNDARY-DOSE-001");
    expect(result.assistantMessage).toContain("cannot provide dosage change instructions");
    expect(result.assistantMessage).toContain("contact your care team now");
    expect(result.ruleSetVersion).toBe("medication-boundary.v1");
  });

  it("blocks medication stop/switch directives with refusal and handoff", () => {
    const result = buildMedicationBoundary(
      "Should I stop taking Medication A?",
      sampleProfile,
      "showcase-profile-summary:patient-401"
    );

    expect(result.isMedicationBoundary).toBe(true);
    expect(result.category).toBe("stop-change");
    expect(result.matchedRuleIds).toContain("MED-BOUNDARY-STOP-001");
    expect(result.assistantMessage).toContain("cannot advise stopping or switching medication");
    expect(result.assistantMessage).toContain("cannot give treatment directives");
  });

  it("classifies mixed dosage and stop requests deterministically", () => {
    const result = buildMedicationBoundary(
      "Can I lower the dose or switch medication?",
      sampleProfile,
      "showcase-profile-summary:patient-401"
    );

    expect(result.isMedicationBoundary).toBe(true);
    expect(result.category).toBe("dosage-and-stop-change");
    expect(result.matchedRuleIds).toEqual([
      "MED-BOUNDARY-DOSE-001",
      "MED-BOUNDARY-STOP-001"
    ]);
  });

  it("covers diverse dosage/stop phrasing variants", () => {
    const prompts = [
      "Please adjust my dose.",
      "Can I double my medication?",
      "I want to quit taking this.",
      "Is it okay to skip my medication today?"
    ];

    for (const prompt of prompts) {
      const result = buildMedicationBoundary(
        prompt,
        sampleProfile,
        "showcase-profile-summary:patient-401"
      );
      expect(result.isMedicationBoundary).toBe(true);
    }
  });

  it("does not block neutral medication education requests", () => {
    const result = buildMedicationBoundary(
      "What does Medication A do?",
      sampleProfile,
      "showcase-profile-summary:patient-401"
    );

    expect(result.isMedicationBoundary).toBe(false);
    expect(result.assistantMessage).toBeNull();
  });
});
