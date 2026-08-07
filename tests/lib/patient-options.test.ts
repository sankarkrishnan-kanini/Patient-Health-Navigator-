import { listDynamicPatientOptions } from "@/lib/showcase/profile-data";

describe("showcase patient options", () => {
  it("loads options only from normalized patient context data", async () => {
    const options = await listDynamicPatientOptions();
    expect(options.length).toBeGreaterThan(0);
  });

  it("contains unique profile ids and non-empty summaries", async () => {
    const options = await listDynamicPatientOptions();
    const ids = options.map((option) => option.profileId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const option of options) {
      expect(option.summary.trim().length).toBeGreaterThan(0);
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});