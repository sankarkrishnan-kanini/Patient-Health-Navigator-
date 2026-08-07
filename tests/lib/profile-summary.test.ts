import { fetchShowcaseProfileSummary } from "@/lib/showcase/profile-summary";
import { listDynamicPatientOptions } from "@/lib/showcase/profile-data";

describe("showcase profile summary", () => {
  it("returns summary payload for known normalized profile", async () => {
    const options = await listDynamicPatientOptions();
    expect(options.length).toBeGreaterThan(0);
    const summary = await fetchShowcaseProfileSummary(options[0].profileId, { delayMs: 0 });

    expect(summary).not.toBeNull();
    expect(summary?.profileId).toBe(options[0].profileId);
    expect(Array.isArray(summary?.careTasks)).toBe(true);
    expect(Array.isArray(summary?.upcomingVisits)).toBe(true);
  });

  it("returns null for unknown profile", async () => {
    const summary = await fetchShowcaseProfileSummary("patient-999", { delayMs: 0 });
    expect(summary).toBeNull();
  });
});