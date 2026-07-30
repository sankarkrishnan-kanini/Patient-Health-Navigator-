import { getChatGateState } from "@/lib/showcase/chat-gating";
import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";

const sampleSummary: PatientProfileSummary = {
  profileId: "patient-400",
  patientId: "patient-400",
  activeConditions: [],
  activeMedications: [],
  careTasks: [],
  upcomingVisits: []
};

describe("chat gating", () => {
  it("disables chat when no profile is confirmed", () => {
    const gate = getChatGateState({
      confirmedProfileId: null,
      isSummaryLoading: false,
      summary: null,
      loadFailure: null
    });

    expect(gate.isChatEnabled).toBe(false);
  });

  it("disables chat while summary is loading", () => {
    const gate = getChatGateState({
      confirmedProfileId: "patient-400",
      isSummaryLoading: true,
      summary: null,
      loadFailure: null
    });

    expect(gate.isChatEnabled).toBe(false);
  });

  it("disables chat when profile summary is unavailable", () => {
    const gate = getChatGateState({
      confirmedProfileId: "patient-400",
      isSummaryLoading: false,
      summary: null,
      loadFailure: null
    });

    expect(gate.isChatEnabled).toBe(false);
  });

  it("disables chat when load failure is unresolved", () => {
    const gate = getChatGateState({
      confirmedProfileId: "patient-400",
      isSummaryLoading: false,
      summary: null,
      loadFailure: {
        code: "FETCH_FAILED",
        message: "failed",
        retryGuidance: "retry"
      }
    });

    expect(gate.isChatEnabled).toBe(false);
  });

  it("enables chat after summary load success", () => {
    const gate = getChatGateState({
      confirmedProfileId: "patient-400",
      isSummaryLoading: false,
      summary: sampleSummary,
      loadFailure: null
    });

    expect(gate.isChatEnabled).toBe(true);
  });
});