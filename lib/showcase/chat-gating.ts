import type { PatientProfileSummary } from "@/lib/showcase/profile-summary";
import type { ProfileLoadFailure } from "@/lib/showcase/profile-load-failure";

export type ChatGateState = {
  isChatEnabled: boolean;
  reason: string;
};

type ChatGateInput = {
  confirmedProfileId: string | null;
  isSummaryLoading: boolean;
  summary: PatientProfileSummary | null;
  loadFailure: ProfileLoadFailure | null;
};

export function getChatGateState(input: ChatGateInput): ChatGateState {
  if (!input.confirmedProfileId) {
    return {
      isChatEnabled: false,
      reason: "Select and confirm a patient profile to enable chat."
    };
  }

  if (input.isSummaryLoading) {
    return {
      isChatEnabled: false,
      reason: "Chat is disabled while the selected profile is loading."
    };
  }

  if (input.loadFailure) {
    return {
      isChatEnabled: false,
      reason: "Chat is disabled until profile load issues are resolved. Use retry to continue."
    };
  }

  if (!input.summary) {
    return {
      isChatEnabled: false,
      reason: "Chat is disabled because the selected profile could not be loaded."
    };
  }

  return {
    isChatEnabled: true,
    reason: "Profile ready. You can start chatting."
  };
}