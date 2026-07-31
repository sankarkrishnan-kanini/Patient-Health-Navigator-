import { buildConditionGuidance } from "@/lib/showcase/condition-guidance";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const conditionProfile: PatientProfileSummary = {
  profileId: "patient-cond",
  patientId: "patient-cond",
  activeConditions: [{ conditionId: "cond-1", label: "Condition A" }],
  activeMedications: [],
  careTasks: [{ carePlanId: "cp-1", description: "Follow up", status: "open" }],
  upcomingVisits: [{ encounterId: "enc-1", status: "planned", start: "2099-01-01T00:00:00Z" }]
};

describe("condition guidance", () => {
  it("returns non-condition intent for unrelated message", () => {
    const result = buildConditionGuidance(
      "What medications am I taking?",
      conditionProfile,
      "showcase-profile-summary:patient-cond"
    );

    expect(result.isConditionIntent).toBe(false);
    expect(result.assistantMessage).toBeNull();
  });

  it("returns linked plain-language explanation for active profile conditions", () => {
    const result = buildConditionGuidance(
      "Can you explain my condition?",
      conditionProfile,
      "showcase-profile-summary:patient-cond"
    );

    expect(result.isConditionIntent).toBe(true);
    expect(result.assistantMessage).toContain("active profile for patient-cond");
    expect(result.assistantMessage).toContain("Condition A");
    expect(result.assistantMessage).toContain("plain language");
    expect(result.profileMarkers.activeConditionCount).toBe(1);
  });

  it("returns safe boundary message for unknown condition requests", () => {
    const result = buildConditionGuidance(
      "Explain asthma",
      conditionProfile,
      "showcase-profile-summary:patient-cond"
    );

    expect(result.isConditionIntent).toBe(true);
    expect(result.assistantMessage).toContain("do not see 'asthma'");
    expect(result.assistantMessage).toContain("cannot confirm or diagnose new conditions");
    expect(result.unknownRequestedCondition).toBe("asthma");
  });

  it("is consistent across repeated condition prompts", () => {
    const first = buildConditionGuidance(
      "Can you explain my condition?",
      conditionProfile,
      "showcase-profile-summary:patient-cond"
    );
    const second = buildConditionGuidance(
      "Can you explain my condition?",
      conditionProfile,
      "showcase-profile-summary:patient-cond"
    );

    expect(first.assistantMessage).toBe(second.assistantMessage);
  });

  it("returns safe fallback when no active conditions are listed", () => {
    const result = buildConditionGuidance(
      "Can you explain my condition?",
      {
        ...conditionProfile,
        activeConditions: []
      },
      "showcase-profile-summary:patient-cond"
    );

    expect(result.isConditionIntent).toBe(true);
    expect(result.assistantMessage).toContain("no active conditions listed");
    expect(result.assistantMessage).toContain("cannot diagnose new conditions");
  });
});
