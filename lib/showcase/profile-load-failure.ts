export type ProfileLoadFailureCode = "NOT_FOUND" | "FETCH_FAILED";

export type ProfileLoadFailure = {
  code: ProfileLoadFailureCode;
  message: string;
  retryGuidance: string;
};

export function classifyProfileLoadFailure(error: unknown): ProfileLoadFailure {
  if (error instanceof Error && error.message === "PROFILE_SUMMARY_NOT_FOUND") {
    return {
      code: "NOT_FOUND",
      message: "Profile summary is not available for the selected patient.",
      retryGuidance: "Retry now or choose a different profile if this keeps happening."
    };
  }

  return {
    code: "FETCH_FAILED",
    message: "We could not load the selected profile summary.",
    retryGuidance: "Retry to request the profile summary again."
  };
}