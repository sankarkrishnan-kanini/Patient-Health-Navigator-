export type ShowcasePatientOption = {
  profileId: string;
  label: string;
  summary: string;
};

export function formatShowcasePatientLabel(profileId: string): string {
  const numeric = profileId.match(/(\d+)$/)?.[1];
  return numeric ? `Patient ${numeric}` : profileId;
}
