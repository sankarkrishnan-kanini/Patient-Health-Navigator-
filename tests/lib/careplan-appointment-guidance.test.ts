import { buildCarePlanAppointmentGuidance } from "@/lib/showcase/careplan-appointment-guidance";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const profileWithCareAndVisit: PatientProfileSummary = {
  profileId: "patient-403",
  patientId: "patient-403",
  activeConditions: [],
  activeMedications: [],
  careTasks: [{ carePlanId: "cp2", description: "Review blood pressure trend", status: "planned" }],
  upcomingVisits: [{ encounterId: "encounter-1", start: "2099-01-01T00:00:00Z", status: "planned" }]
};

describe("care plan and appointment guidance", () => {
  it("returns appointment-grounded response with schedule details", () => {
    const result = buildCarePlanAppointmentGuidance(
      "When is my next appointment?",
      profileWithCareAndVisit,
      "showcase-profile-summary:patient-403"
    );

    expect(result.isIntentMatch).toBe(true);
    expect(result.intent).toBe("appointment");
    expect(result.assistantMessage).toContain("upcoming visit details");
    expect(result.assistantMessage).toContain("2099-01-01T00:00:00Z");
    expect(result.usedVisitIds).toEqual(["encounter-1"]);
  });

  it("returns care-plan grounded response with task relevance", () => {
    const result = buildCarePlanAppointmentGuidance(
      "What is in my care plan?",
      profileWithCareAndVisit,
      "showcase-profile-summary:patient-403"
    );

    expect(result.isIntentMatch).toBe(true);
    expect(result.intent).toBe("care-plan");
    expect(result.assistantMessage).toContain("care plan tasks");
    expect(result.assistantMessage).toContain("Review blood pressure trend");
    expect(result.usedCareTaskIds).toEqual(["cp2"]);
  });

  it("returns fallback when schedule or task data is missing", () => {
    const appointmentFallback = buildCarePlanAppointmentGuidance(
      "Do I have an appointment?",
      {
        ...profileWithCareAndVisit,
        upcomingVisits: []
      },
      "showcase-profile-summary:patient-403"
    );

    const careFallback = buildCarePlanAppointmentGuidance(
      "Any care tasks for me?",
      {
        ...profileWithCareAndVisit,
        careTasks: []
      },
      "showcase-profile-summary:patient-403"
    );

    expect(appointmentFallback.missingScheduleData).toBe(true);
    expect(appointmentFallback.assistantMessage).toContain("no upcoming visits listed");
    expect(careFallback.missingTaskData).toBe(true);
    expect(careFallback.assistantMessage).toContain("no care plan tasks listed");
  });

  it("returns deterministic output for repeated prompts", () => {
    const first = buildCarePlanAppointmentGuidance(
      "When is my next appointment?",
      profileWithCareAndVisit,
      "showcase-profile-summary:patient-403"
    );
    const second = buildCarePlanAppointmentGuidance(
      "When is my next appointment?",
      profileWithCareAndVisit,
      "showcase-profile-summary:patient-403"
    );

    expect(first.assistantMessage).toBe(second.assistantMessage);
  });
});
