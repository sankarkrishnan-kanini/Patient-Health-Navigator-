import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  formatShowcasePatientLabel,
  type ShowcasePatientOption
} from "@/lib/showcase/patient-options";
import type {
  PatientProfileSummary,
  ProfileCareTask,
  ProfileCondition,
  ProfileMedication,
  ProfileVisit
} from "@/lib/showcase/profile-summary";

type RawPatientRecord = {
  patientId?: string;
  activeConditions?: unknown[];
  activeMedications?: unknown[];
  careTasks?: unknown[];
  upcomingAppointments?: unknown[];
  upcomingVisits?: unknown[];
};

type SourceMode = "file" | "api";

type FhirBundle = {
  entry?: Array<{
    resource?: Record<string, unknown>;
  }>;
};

type FhirResource = Record<string, unknown>;

function getSourceMode(): SourceMode {
  const mode = process.env.SYNTHEA_SOURCE_MODE?.trim().toLowerCase();
  return mode === "api" ? "api" : "file";
}

function hasApiConfig(): boolean {
  return typeof process.env.SYNTHEA_FHIR_BASE_URL === "string" &&
    process.env.SYNTHEA_FHIR_BASE_URL.trim().length > 0;
}

export function getSyntheaSourceMode(): SourceMode {
  return getSourceMode();
}

function getPatientReferenceId(reference: unknown): string | null {
  if (typeof reference !== "string") {
    return null;
  }

  const trimmed = reference.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.includes("/")) {
    return trimmed.split("/").at(-1) ?? null;
  }

  return trimmed;
}

function buildApiHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/fhir+json, application/json"
  };

  const bearerToken = process.env.SYNTHEA_FHIR_BEARER_TOKEN?.trim();
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const apiKey = process.env.SYNTHEA_FHIR_API_KEY?.trim();
  if (apiKey) {
    const keyHeader = process.env.SYNTHEA_FHIR_API_KEY_HEADER?.trim() || "x-api-key";
    headers[keyHeader] = apiKey;
  }

  return headers;
}

function buildApiUrl(resourcePath: string, searchParams?: Record<string, string>): string {
  const baseUrl = process.env.SYNTHEA_FHIR_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("Missing SYNTHEA_FHIR_BASE_URL for API mode.");
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function fetchFhirBundle(resourcePath: string, searchParams?: Record<string, string>): Promise<FhirBundle> {
  const timeoutMs = Number.parseInt(process.env.SYNTHEA_FHIR_TIMEOUT_MS ?? "12000", 10);
  const timeout = Number.isNaN(timeoutMs) ? 12000 : Math.max(timeoutMs, 1000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(buildApiUrl(resourcePath, searchParams), {
      method: "GET",
      headers: buildApiHeaders(),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`FHIR API request failed (${response.status}) for ${resourcePath}.`);
    }

    const payload = (await response.json()) as FhirBundle;
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function getBundleResources(bundle: FhirBundle): FhirResource[] {
  if (!Array.isArray(bundle.entry)) {
    return [];
  }

  return bundle.entry
    .map((entry) => (entry?.resource && typeof entry.resource === "object" ? entry.resource : null))
    .filter((resource): resource is FhirResource => resource !== null);
}

function resolveConceptText(concept: unknown, fallback: string): string {
  const conceptRecord = toRecord(concept);
  const fromText = toNullableText(conceptRecord.text);
  if (fromText) {
    return fromText;
  }

  const coding = Array.isArray(conceptRecord.coding) ? conceptRecord.coding[0] : null;
  const codingRecord = toRecord(coding);
  return toText(codingRecord.display ?? codingRecord.code, fallback);
}

function mapConditionFromFhir(resource: FhirResource): ProfileCondition {
  return {
    conditionId: toText(resource.id, "condition"),
    label: resolveConceptText(resource.code, "Condition")
  };
}

function mapMedicationFromFhir(resource: FhirResource): ProfileMedication {
  const dosageInstruction = Array.isArray(resource.dosageInstruction)
    ? toRecord(resource.dosageInstruction[0])
    : {};

  return {
    medicationId: toText(resource.id, "medication"),
    name: resolveConceptText(resource.medicationCodeableConcept, "Medication"),
    schedule: toNullableText(dosageInstruction.text),
    purpose: null
  };
}

function mapCareTaskFromFhir(resource: FhirResource): ProfileCareTask {
  const activity = Array.isArray(resource.activity) ? toRecord(resource.activity[0]) : {};
  const detail = toRecord(activity.detail);

  return {
    carePlanId: toText(resource.id, "care-plan"),
    description: toText(detail.description, "Care task"),
    status: toText(resource.status, "unknown")
  };
}

function mapVisitFromFhir(resource: FhirResource): ProfileVisit {
  const period = toRecord(resource.period);

  return {
    encounterId: toText(resource.id, "encounter"),
    status: toText(resource.status, "unknown"),
    start: toNullableText(period.start)
  };
}

function mapPatientOptionFromFhir(resource: FhirResource): ShowcasePatientOption | null {
  const patientId = toNullableText(resource.id);
  if (!patientId) {
    return null;
  }

  return {
    profileId: patientId,
    label: formatShowcasePatientLabel(patientId),
    summary: "Synthea profile loaded from FHIR API."
  };
}

async function listPatientOptionsFromApi(): Promise<ShowcasePatientOption[]> {
  const patientEndpoint = process.env.SYNTHEA_FHIR_PATIENT_ENDPOINT?.trim() || "/Patient";
  const bundle = await fetchFhirBundle(patientEndpoint, {
    _count: process.env.SYNTHEA_FHIR_PATIENT_COUNT?.trim() || "50"
  });

  const options = getBundleResources(bundle)
    .map((resource) => mapPatientOptionFromFhir(resource))
    .filter((option): option is ShowcasePatientOption => option !== null);

  const unique = new Map<string, ShowcasePatientOption>();
  for (const option of options) {
    unique.set(option.profileId, option);
  }

  return [...unique.values()].sort((a, b) => a.profileId.localeCompare(b.profileId));
}

async function loadProfileSummaryFromApi(profileId: string): Promise<PatientProfileSummary | null> {
  const conditionEndpoint = process.env.SYNTHEA_FHIR_CONDITION_ENDPOINT?.trim() || "/Condition";
  const medicationEndpoint = process.env.SYNTHEA_FHIR_MEDICATION_ENDPOINT?.trim() || "/MedicationRequest";
  const carePlanEndpoint = process.env.SYNTHEA_FHIR_CAREPLAN_ENDPOINT?.trim() || "/CarePlan";
  const encounterEndpoint = process.env.SYNTHEA_FHIR_ENCOUNTER_ENDPOINT?.trim() || "/Encounter";

  const [conditionsBundle, medicationsBundle, carePlansBundle, encountersBundle] = await Promise.all([
    fetchFhirBundle(conditionEndpoint, { patient: profileId, _count: "25" }),
    fetchFhirBundle(medicationEndpoint, { patient: profileId, _count: "25" }),
    fetchFhirBundle(carePlanEndpoint, { patient: profileId, _count: "25" }),
    fetchFhirBundle(encounterEndpoint, { patient: profileId, _count: "25" })
  ]);

  const activeConditions = getBundleResources(conditionsBundle)
    .filter((resource) => getPatientReferenceId(toRecord(resource.subject).reference) === profileId)
    .map((resource) => mapConditionFromFhir(resource));

  const activeMedications = getBundleResources(medicationsBundle)
    .filter((resource) => getPatientReferenceId(toRecord(resource.subject).reference) === profileId)
    .map((resource) => mapMedicationFromFhir(resource));

  const careTasks = getBundleResources(carePlansBundle)
    .filter((resource) => getPatientReferenceId(toRecord(resource.subject).reference) === profileId)
    .map((resource) => mapCareTaskFromFhir(resource));

  const upcomingVisits = getBundleResources(encountersBundle)
    .filter((resource) => getPatientReferenceId(toRecord(resource.subject).reference) === profileId)
    .map((resource) => mapVisitFromFhir(resource));

  return {
    profileId,
    patientId: profileId,
    activeConditions,
    activeMedications,
    careTasks,
    upcomingVisits
  };
}

function listRunDirectories(rootDirectory: string): string[] {
  try {
    return readdirSync(rootDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }
}

function resolveLatestPatientsDirectory(rootDirectory: string): string | null {
  const runDirectories = listRunDirectories(rootDirectory);

  for (const runDirectory of runDirectories) {
    const candidate = path.join(rootDirectory, runDirectory, "patients");
    try {
      const jsonCount = readdirSync(candidate).filter((name) => name.toLowerCase().endsWith(".json")).length;
      if (jsonCount > 0) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function getPatientsDirectory(): string | null {
  const fromEnv = process.env.SYNTHEA_PATIENTS_DIR?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const normalizedRoot = path.join(
    process.cwd(),
    ".propel",
    "context",
    "data",
    "normalized",
    "patient-context"
  );
  const normalizedPatients = resolveLatestPatientsDirectory(normalizedRoot);
  if (normalizedPatients) {
    return normalizedPatients;
  }

  const curatedRoot = path.join(
    process.cwd(),
    ".propel",
    "context",
    "data",
    "curated",
    "showcase-cohort"
  );
  return resolveLatestPatientsDirectory(curatedRoot);
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown, fallback = "Unknown"): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function toNullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toProfileConditions(values: unknown[]): ProfileCondition[] {
  return values.map((item, index) => {
    const record = toRecord(item);
    return {
      conditionId: toText(record.conditionId ?? record.id, `condition-${index + 1}`),
      label: toText(record.label ?? record.codeText ?? record.code, "Condition")
    };
  });
}

function toProfileMedications(values: unknown[]): ProfileMedication[] {
  return values.map((item, index) => {
    const record = toRecord(item);
    return {
      medicationId: toText(record.medicationId ?? record.id, `medication-${index + 1}`),
      name: toText(record.name, "Medication"),
      schedule: toNullableText(record.schedule ?? record.scheduleText),
      purpose: toNullableText(record.purpose)
    };
  });
}

function toProfileTasks(values: unknown[]): ProfileCareTask[] {
  return values.map((item, index) => {
    const record = toRecord(item);
    return {
      carePlanId: toText(record.carePlanId ?? record.id, `care-task-${index + 1}`),
      description: toText(record.description, "Care task"),
      status: toText(record.status, "unknown")
    };
  });
}

function toProfileVisits(values: unknown[]): ProfileVisit[] {
  return values.map((item, index) => {
    const record = toRecord(item);
    return {
      encounterId: toText(record.encounterId ?? record.id, `visit-${index + 1}`),
      status: toText(record.status, "unknown"),
      start: toNullableText(record.start)
    };
  });
}

function summarizeProfile(summary: PatientProfileSummary): string {
  const parts: string[] = [];

  if (summary.activeConditions.length > 0) {
    parts.push(`${summary.activeConditions.length} condition(s)`);
  }

  if (summary.activeMedications.length > 0) {
    parts.push(`${summary.activeMedications.length} medication(s)`);
  }

  if (summary.careTasks.length > 0) {
    parts.push(`${summary.careTasks.length} care task(s)`);
  }

  if (summary.upcomingVisits.length > 0) {
    parts.push(`${summary.upcomingVisits.length} upcoming visit(s)`);
  }

  return parts.length > 0
    ? `Synthea profile with ${parts.join(", ")}.`
    : "Synthea profile with baseline clinical context.";
}

function parsePatientFile(filePath: string): PatientProfileSummary | null {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as RawPatientRecord;
    if (!parsed.patientId || parsed.patientId.trim().length === 0) {
      return null;
    }

    const activeConditions = Array.isArray(parsed.activeConditions)
      ? toProfileConditions(parsed.activeConditions)
      : [];
    const activeMedications = Array.isArray(parsed.activeMedications)
      ? toProfileMedications(parsed.activeMedications)
      : [];
    const careTasks = Array.isArray(parsed.careTasks) ? toProfileTasks(parsed.careTasks) : [];
    const visitsSource = Array.isArray(parsed.upcomingVisits)
      ? parsed.upcomingVisits
      : Array.isArray(parsed.upcomingAppointments)
        ? parsed.upcomingAppointments
        : [];
    const upcomingVisits = toProfileVisits(visitsSource);

    return {
      profileId: parsed.patientId,
      patientId: parsed.patientId,
      activeConditions,
      activeMedications,
      careTasks,
      upcomingVisits
    };
  } catch {
    return null;
  }
}

function loadAllPatientSummaries(): PatientProfileSummary[] {
  const directory = getPatientsDirectory();
  if (!directory) {
    return [];
  }

  try {
    const files = readdirSync(directory)
      .filter((name) => name.toLowerCase().endsWith(".json"))
      .sort((a, b) => a.localeCompare(b));

    const summaries = files
      .map((name) => parsePatientFile(path.join(directory, name)))
      .filter((summary): summary is PatientProfileSummary => summary !== null);

    return summaries;
  } catch {
    return [];
  }
}

export function listSyntheaPatientOptions(): ShowcasePatientOption[] {
  return loadAllPatientSummaries().map((summary) => ({
    profileId: summary.profileId,
    label: formatShowcasePatientLabel(summary.profileId),
    summary: summarizeProfile(summary)
  }));
}

export function getSyntheaPatientById(profileId: string): ShowcasePatientOption | undefined {
  return listSyntheaPatientOptions().find((option) => option.profileId === profileId);
}

export function fetchSyntheaProfileSummary(profileId: string): PatientProfileSummary | null {
  return loadAllPatientSummaries().find((summary) => summary.profileId === profileId) ?? null;
}

export async function listSyntheaPatientOptionsAsync(): Promise<ShowcasePatientOption[]> {
  if (getSourceMode() === "api" && hasApiConfig()) {
    try {
      return await listPatientOptionsFromApi();
    } catch {
      return listSyntheaPatientOptions();
    }
  }

  return listSyntheaPatientOptions();
}

export async function getSyntheaPatientByIdAsync(
  profileId: string
): Promise<ShowcasePatientOption | undefined> {
  const options = await listSyntheaPatientOptionsAsync();
  return options.find((option) => option.profileId === profileId);
}

export async function fetchSyntheaProfileSummaryAsync(
  profileId: string
): Promise<PatientProfileSummary | null> {
  if (getSourceMode() === "api" && hasApiConfig()) {
    try {
      return await loadProfileSummaryFromApi(profileId);
    } catch {
      return fetchSyntheaProfileSummary(profileId);
    }
  }

  return fetchSyntheaProfileSummary(profileId);
}
