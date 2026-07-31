import { buildMedicationGuidance } from "@/lib/showcase/medication-guidance";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const medicationProfile: PatientProfileSummary = {
  profileId: "patient-med",
  patientId: "patient-med",
  activeConditions: [],
  activeMedications: [
    {
      medicationId: "med-1",
      name: "Medication A",
      schedule: "Every morning",
      purpose: "Blood sugar management"
    },
    {
      medicationId: "med-2",
      name: "Medication B",
      schedule: null,
      purpose: null
    }
  ],
  careTasks: [],
  upcomingVisits: []
};

describe("medication guidance", () => {
  it("returns non-medication intent for unrelated message", () => {
    const result = buildMedicationGuidance(
      "Tell me about my next appointment",
      medicationProfile,
      "showcase-profile-summary:patient-med"
    );

    expect(result.isMedicationIntent).toBe(false);
    expect(result.assistantMessage).toBeNull();
    expect(result.medicationsUsed).toHaveLength(0);
  });

  it("grounds medication response and flags missing profile details", () => {
    const result = buildMedicationGuidance(
      "What medications am I taking?",
      medicationProfile,
      "showcase-profile-summary:patient-med"
    );

    expect(result.isMedicationIntent).toBe(true);
    expect(result.assistantMessage).toContain("Medication A");
    expect(result.assistantMessage).toContain("Medication B");
    expect(result.assistantMessage).toContain("schedule not recorded");
    expect(result.assistantMessage).toContain("purpose not recorded");
    expect(result.assistantMessage).toContain("cannot add assumptions");
    expect(result.contextSourceRefs).toEqual(["showcase-profile-summary:patient-med"]);
    expect(result.missingDetailMedicationIds).toEqual(["med-2"]);
  });

  it("returns safe fallback when no active medications are available", () => {
    const result = buildMedicationGuidance(
      "Can you review my meds?",
      {
        ...medicationProfile,
        activeMedications: []
      },
      "showcase-profile-summary:patient-med"
    );

    expect(result.isMedicationIntent).toBe(true);
    expect(result.assistantMessage).toContain("no active medications listed");
    expect(result.medicationsUsed).toEqual([]);
  });
});
