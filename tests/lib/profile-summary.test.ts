import { fetchShowcaseProfileSummary } from "@/lib/showcase/profile-summary";

describe("showcase profile summary", () => {
  it("returns summary payload for known showcase profile", async () => {
    const summary = await fetchShowcaseProfileSummary("patient-403", { delayMs: 0 });

    expect(summary).not.toBeNull();
    expect(summary?.profileId).toBe("patient-403");
    expect(Array.isArray(summary?.careTasks)).toBe(true);
    expect(Array.isArray(summary?.upcomingVisits)).toBe(true);
  });

  it("returns null for unknown profile", async () => {
    const summary = await fetchShowcaseProfileSummary("patient-999", { delayMs: 0 });
    expect(summary).toBeNull();
  });
});