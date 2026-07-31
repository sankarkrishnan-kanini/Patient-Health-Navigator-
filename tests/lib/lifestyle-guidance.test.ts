import { buildLifestyleGuidance } from "@/lib/showcase/lifestyle-guidance";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const dietProfile: PatientProfileSummary = {
  profileId: "patient-402",
  patientId: "patient-402",
  activeConditions: [],
  activeMedications: [
    {
      medicationId: "m2",
      name: "Medication B",
      schedule: "Twice daily with meals",
      purpose: null
    }
  ],
  careTasks: [{ carePlanId: "cp1", description: "Annual wellness follow-up", status: "open" }],
  upcomingVisits: []
};

const activityProfile: PatientProfileSummary = {
  profileId: "patient-403",
  patientId: "patient-403",
  activeConditions: [],
  activeMedications: [],
  careTasks: [{ carePlanId: "cp2", description: "Review blood pressure trend", status: "planned" }],
  upcomingVisits: [{ encounterId: "encounter-1", status: "planned", start: "2099-01-01T00:00:00Z" }]
};

describe("lifestyle guidance", () => {
  it("grounds diet guidance to profile context", () => {
    const result = buildLifestyleGuidance(
      "What should I eat?",
      dietProfile,
      "showcase-profile-summary:patient-402"
    );

    expect(result.isLifestyleIntent).toBe(true);
    expect(result.intent).toBe("diet");
    expect(result.assistantMessage).toContain("Medication B");
    expect(result.assistantMessage).toContain("Twice daily with meals");
    expect(result.assistantMessage).toContain("Annual wellness follow-up");
    expect(result.contextSourceRefs).toEqual(["showcase-profile-summary:patient-402"]);
  });

  it("grounds activity guidance to profile context without contradiction", () => {
    const result = buildLifestyleGuidance(
      "How active should I be?",
      activityProfile,
      "showcase-profile-summary:patient-403"
    );

    expect(result.isLifestyleIntent).toBe(true);
    expect(result.intent).toBe("activity");
    expect(result.assistantMessage).toContain("steady, manageable activity");
    expect(result.assistantMessage).toContain("Review blood pressure trend");
    expect(result.assistantMessage).toContain("2099-01-01T00:00:00Z");
    expect(result.assistantMessage).not.toContain("high-intensity training");
  });

  it("returns safe boundary for out-of-scope lifestyle requests", () => {
    const result = buildLifestyleGuidance(
      "Build me an exact 7-day meal plan with macro targets.",
      dietProfile,
      "showcase-profile-summary:patient-402"
    );

    expect(result.isLifestyleIntent).toBe(true);
    expect(result.isOutOfScope).toBe(true);
    expect(result.assistantMessage).toContain("cannot create a personalized medical diet or exercise prescription");
  });

  it("returns deterministic output for repeated lifestyle prompts", () => {
    const first = buildLifestyleGuidance(
      "What should I eat?",
      dietProfile,
      "showcase-profile-summary:patient-402"
    );
    const second = buildLifestyleGuidance(
      "What should I eat?",
      dietProfile,
      "showcase-profile-summary:patient-402"
    );

    expect(first.assistantMessage).toBe(second.assistantMessage);
  });
});
