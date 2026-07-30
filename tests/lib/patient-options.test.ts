import {
  getShowcasePatientById,
  SHOWCASE_PATIENT_OPTIONS
} from "@/lib/showcase/patient-options";

describe("showcase patient options", () => {
  it("provides a selectable showcase list between 5 and 10 profiles", () => {
    expect(SHOWCASE_PATIENT_OPTIONS.length).toBeGreaterThanOrEqual(5);
    expect(SHOWCASE_PATIENT_OPTIONS.length).toBeLessThanOrEqual(10);
  });

  it("contains unique profile ids and non-empty summaries", () => {
    const ids = SHOWCASE_PATIENT_OPTIONS.map((option) => option.profileId);
    expect(new Set(ids).size).toBe(ids.length);

    for (const option of SHOWCASE_PATIENT_OPTIONS) {
      expect(option.summary.trim().length).toBeGreaterThan(0);
      expect(getShowcasePatientById(option.profileId)?.label).toBe(option.label);
    }
  });
});