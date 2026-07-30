export type ShowcasePatientOption = {
  profileId: string;
  label: string;
  summary: string;
};

export const SHOWCASE_PATIENT_OPTIONS: ShowcasePatientOption[] = [
  {
    profileId: "patient-400",
    label: "Patient 400",
    summary: "Chronic-care profile with active condition monitoring needs."
  },
  {
    profileId: "patient-401",
    label: "Patient 401",
    summary: "Medication-management profile focused on therapy adherence."
  },
  {
    profileId: "patient-402",
    label: "Patient 402",
    summary: "Preventive-care profile with open care task follow-ups."
  },
  {
    profileId: "patient-403",
    label: "Patient 403",
    summary: "Symptom-oriented profile with recent clinical observations."
  },
  {
    profileId: "patient-404",
    label: "Patient 404",
    summary: "Mixed-complexity profile balancing routine and chronic needs."
  },
  {
    profileId: "patient-405",
    label: "Patient 405",
    summary: "General profile suitable for baseline navigation scenarios."
  }
];

export function getShowcasePatientById(profileId: string): ShowcasePatientOption | undefined {
  return SHOWCASE_PATIENT_OPTIONS.find((option) => option.profileId === profileId);
}