import { classifyProfileLoadFailure } from "@/lib/showcase/profile-load-failure";

describe("profile load failure classification", () => {
  it("classifies not-found summary failures", () => {
    const failure = classifyProfileLoadFailure(new Error("PROFILE_SUMMARY_NOT_FOUND"));

    expect(failure.code).toBe("NOT_FOUND");
    expect(failure.retryGuidance.length).toBeGreaterThan(0);
  });

  it("classifies generic fetch failures", () => {
    const failure = classifyProfileLoadFailure(new Error("network timeout"));

    expect(failure.code).toBe("FETCH_FAILED");
    expect(failure.retryGuidance).toContain("Retry");
  });
});