import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { REQUIRED_FHIR_RESOURCE_TYPES } from "@/lib/data-ingestion/fhir-ingestion";

type RequiredResourceType = (typeof REQUIRED_FHIR_RESOURCE_TYPES)[number];

type Coding = {
  code?: string;
  display?: string;
};

type CodeableConcept = {
  text?: string;
  coding?: Coding[];
};

type Reference = {
  reference?: string;
};

type FhirResource = {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
};

type StagedResourceRecord = {
  runId: string;
  sourceFile: string;
  resourceType: RequiredResourceType;
  resourceId: string;
  ingestedAt: string;
  payload: FhirResource;
};

type ValidationSeverity = "error" | "warning";

type ValidationIssue = {
  field: string;
  message: string;
  severity: ValidationSeverity;
};

export type NormalizationValidationFailure = {
  runId: string;
  patientId: string | null;
  resourceType: RequiredResourceType;
  resourceId: string;
  category: string;
  sourceFile: string;
  issues: ValidationIssue[];
  recordedAt: string;
};

export type NormalizationValidationReport = {
  runId: string;
  generatedAt: string;
  totalFailures: number;
  failuresByCategory: Record<string, number>;
  failuresByResourceType: Record<RequiredResourceType, number>;
  failures: NormalizationValidationFailure[];
};

export type NormalizationDuplicateEvent = {
  runId: string;
  patientId: string;
  entityType: NormalizedEntityType;
  idempotencyKey: string;
  reason: string;
  detectedAt: string;
};

export type NormalizedEntityType =
  | "activeConditions"
  | "activeMedications"
  | "careTasks"
  | "upcomingAppointments"
  | "observations"
  | "sdohFlags";

export type NormalizationLineageEntry = {
  runId: string;
  ingestionRunId: string;
  profileVersion: string;
  transformationRuleVersion: string;
  patientId: string;
  sourceResourceType: RequiredResourceType;
  sourceResourceId: string;
  sourceFile: string;
  targetEntityType: NormalizedEntityType;
  targetEntityId: string;
  idempotencyKey: string;
  recordedAt: string;
};

export type LineageMissingEntry = {
  patientId: string;
  targetEntityType: NormalizedEntityType;
  targetEntityId: string;
  idempotencyKey: string;
};

export type NormalizationLineageQualityReport = {
  runId: string;
  generatedAt: string;
  totalExpected: number;
  totalRecorded: number;
  totalMissing: number;
  missingEntries: LineageMissingEntry[];
};

export type NormalizationReprocessingHistoryEntry = {
  runId: string;
  profileVersion: string;
  stagedDirectory: string;
  outputDirectory: string;
  patientCount: number;
  generatedAt: string;
  validationFailureCount: number;
  duplicateEventCount: number;
};

type ActiveCondition = {
  conditionId: string;
  codeText: string;
  clinicalStatus: string;
  onsetDate: string | null;
};

type ActiveMedication = {
  medicationId: string;
  name: string;
  doseText: string;
  scheduleText: string;
  status: string;
  authoredOn: string | null;
};

type CareTask = {
  carePlanId: string;
  description: string;
  status: string;
  dueDate: string | null;
};

type UpcomingAppointment = {
  encounterId: string;
  classText: string;
  status: string;
  start: string | null;
  end: string | null;
};

type RelevantObservation = {
  observationId: string;
  codeText: string;
  valueText: string;
  issued: string | null;
};

type SdohFlag = {
  observationId: string;
  flag: string;
  value: string;
  recordedAt: string | null;
};

export type NormalizedPatientContext = {
  patientId: string;
  profileVersion: string;
  sourceRunId: string;
  generatedAt: string;
  activeConditions: ActiveCondition[];
  activeMedications: ActiveMedication[];
  careTasks: CareTask[];
  upcomingAppointments: UpcomingAppointment[];
  observations: RelevantObservation[];
  sdohFlags: SdohFlag[];
};

export type FhirNormalizationSummary = {
  runId: string;
  stagedDirectory: string;
  outputDirectory: string;
  patientCount: number;
  outputFiles: string[];
  profileVersion: string;
  generatedAt: string;
  validationReportPath: string;
  validationFailureCount: number;
  validationFailuresByCategory: Record<string, number>;
  duplicateEventCount: number;
  duplicateEventsPath: string;
  idempotencyHistoryPath: string;
  lineagePath: string;
  lineageCount: number;
  lineageQualityReportPath: string;
  missingLineageCount: number;
};

export type FhirNormalizationOptions = {
  runId: string;
  stagedRootPath?: string;
  outputRootPath?: string;
  profileVersion?: string;
};

function isMissingText(value: string | null | undefined): boolean {
  if (!value || !value.trim()) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "unknown" || normalized === "unspecified" || normalized === "not recorded";
}

function createIssue(field: string, message: string, severity: ValidationSeverity = "error"): ValidationIssue {
  return { field, message, severity };
}

function idempotencyKey(patientId: string, entityType: string, entityId: string): string {
  return `${patientId}:${entityType}:${entityId}`;
}

function resourceTypeFromEntityType(entityType: NormalizedEntityType): RequiredResourceType {
  switch (entityType) {
    case "activeConditions":
      return "Condition";
    case "activeMedications":
      return "MedicationRequest";
    case "careTasks":
      return "CarePlan";
    case "upcomingAppointments":
      return "Encounter";
    case "observations":
    case "sdohFlags":
      return "Observation";
    default:
      return "Patient";
  }
}

async function readNdjsonLines<T>(filePath: string): Promise<T[]> {
  const content = await readFile(filePath, "utf8").catch(() => "");
  if (!content.trim()) {
    return [];
  }

  return content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as T);
}

async function appendNdjsonLine(filePath: string, record: unknown): Promise<void> {
  const existing = await readFile(filePath, "utf8").catch(() => "");
  const nextContent = `${existing}${JSON.stringify(record)}\n`;
  await writeFile(filePath, nextContent, "utf8");
}

async function writeNdjsonLines(filePath: string, records: unknown[]): Promise<void> {
  if (records.length === 0) {
    await writeFile(filePath, "", "utf8");
    return;
  }

  const content = records.map((record) => JSON.stringify(record)).join("\n");
  await writeFile(filePath, `${content}\n`, "utf8");
}

function recordLineageEntry(
  target: NormalizationLineageEntry[],
  record: StagedResourceRecord,
  patientId: string,
  targetEntityType: NormalizedEntityType,
  targetEntityId: string,
  profileVersion: string
) {
  target.push({
    runId: record.runId,
    ingestionRunId: record.runId,
    profileVersion,
    transformationRuleVersion: profileVersion,
    patientId,
    sourceResourceType: record.resourceType,
    sourceResourceId: record.resourceId,
    sourceFile: record.sourceFile,
    targetEntityType,
    targetEntityId,
    idempotencyKey: idempotencyKey(patientId, targetEntityType, targetEntityId),
    recordedAt: isoNow()
  });
}

function expectedLineageKeysFromContexts(
  contexts: Map<string, NormalizedPatientContext>
): Set<string> {
  const expected = new Set<string>();

  for (const [patientId, context] of contexts.entries()) {
    for (const entity of context.activeConditions) {
      expected.add(idempotencyKey(patientId, "activeConditions", entity.conditionId));
    }

    for (const entity of context.activeMedications) {
      expected.add(idempotencyKey(patientId, "activeMedications", entity.medicationId));
    }

    for (const entity of context.careTasks) {
      expected.add(idempotencyKey(patientId, "careTasks", entity.carePlanId));
    }

    for (const entity of context.upcomingAppointments) {
      expected.add(idempotencyKey(patientId, "upcomingAppointments", entity.encounterId));
    }

    for (const entity of context.observations) {
      expected.add(idempotencyKey(patientId, "observations", entity.observationId));
    }

    for (const entity of context.sdohFlags) {
      expected.add(idempotencyKey(patientId, "sdohFlags", entity.observationId));
    }
  }

  return expected;
}

function parseLineageKey(key: string): LineageMissingEntry {
  const [patientId = "unknown", targetEntityType = "observations", targetEntityId = "unknown"] = key.split(":");
  return {
    patientId,
    targetEntityType: targetEntityType as NormalizedEntityType,
    targetEntityId,
    idempotencyKey: key
  };
}

function buildLineageQualityReport(
  runId: string,
  contexts: Map<string, NormalizedPatientContext>,
  lineageEntries: NormalizationLineageEntry[]
): NormalizationLineageQualityReport {
  const expectedKeys = expectedLineageKeysFromContexts(contexts);
  const recordedKeys = new Set(lineageEntries.map((entry) => entry.idempotencyKey));
  const missingEntries = Array.from(expectedKeys)
    .filter((key) => !recordedKeys.has(key))
    .map(parseLineageKey);

  return {
    runId,
    generatedAt: isoNow(),
    totalExpected: expectedKeys.size,
    totalRecorded: recordedKeys.size,
    totalMissing: missingEntries.length,
    missingEntries
  };
}

function buildFailuresByResourceType(): Record<RequiredResourceType, number> {
  return {
    Patient: 0,
    Condition: 0,
    MedicationRequest: 0,
    CarePlan: 0,
    Encounter: 0,
    Observation: 0
  };
}

function getConceptText(concept: unknown): string {
  if (!concept || typeof concept !== "object") {
    return "unknown";
  }

  const parsed = concept as CodeableConcept;
  if (parsed.text) {
    return parsed.text;
  }

  return parsed.coding?.[0]?.display ?? parsed.coding?.[0]?.code ?? "unknown";
}

function referencePatientId(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const reference = (value as Reference).reference;
  if (!reference) {
    return null;
  }

  const parts = reference.split("/");
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

function isoNow(): string {
  return new Date().toISOString();
}

function isFutureOrToday(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return timestamp >= today.getTime();
}

function clinicalStatus(resource: FhirResource): string {
  return getConceptText(resource.clinicalStatus);
}

function isConditionActive(resource: FhirResource): boolean {
  const statusField = resource.clinicalStatus as CodeableConcept | undefined;
  const coding = Array.isArray(statusField?.coding) ? statusField.coding : [];

  if (coding.some((entry) => entry.code?.toLowerCase() === "active")) {
    return true;
  }

  const normalizedText = clinicalStatus(resource).trim().toLowerCase();
  return normalizedText === "active";
}

function medicationStatus(resource: FhirResource): string {
  return typeof resource.status === "string" ? resource.status : "unknown";
}

function extractDoseText(resource: FhirResource): string {
  const dosage = Array.isArray(resource.dosageInstruction)
    ? (resource.dosageInstruction[0] as { text?: string } | undefined)
    : undefined;

  return dosage?.text ?? "unspecified";
}

function extractScheduleText(resource: FhirResource): string {
  const dosage = Array.isArray(resource.dosageInstruction)
    ? (resource.dosageInstruction[0] as { timing?: { code?: CodeableConcept } } | undefined)
    : undefined;

  return getConceptText(dosage?.timing?.code);
}

function extractCarePlanTask(resource: FhirResource): CareTask {
  const activities = Array.isArray(resource.activity)
    ? (resource.activity as Array<{ detail?: { description?: string; status?: string; scheduledString?: string } }>)
    : [];

  const first = activities[0]?.detail;

  return {
    carePlanId: resource.id ?? "unknown",
    description: first?.description ?? "unspecified task",
    status: first?.status ?? (typeof resource.status === "string" ? resource.status : "unknown"),
    dueDate: first?.scheduledString ?? null
  };
}

function extractEncounterDate(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const period = value as { start?: string; end?: string };
  return period.start ?? period.end ?? null;
}

function extractObservationValue(resource: FhirResource): string {
  const valueString = typeof resource.valueString === "string" ? resource.valueString : null;
  if (valueString) {
    return valueString;
  }

  const quantity = resource.valueQuantity as { value?: number; unit?: string } | undefined;
  if (quantity && typeof quantity.value === "number") {
    return `${quantity.value}${quantity.unit ? ` ${quantity.unit}` : ""}`;
  }

  const codeable = resource.valueCodeableConcept as CodeableConcept | undefined;
  if (codeable) {
    return getConceptText(codeable);
  }

  return "not recorded";
}

function isSdohObservation(resource: FhirResource): boolean {
  if (!Array.isArray(resource.category)) {
    return false;
  }

  return resource.category.some((category) => {
    const coding = (category as { coding?: Coding[] }).coding;
    if (!Array.isArray(coding)) {
      return false;
    }

    return coding.some((entry) => entry.code === "social-history");
  });
}

async function readNdjsonRecords(filePath: string): Promise<StagedResourceRecord[]> {
  const content = await readFile(filePath, "utf8").catch(() => "");
  if (!content.trim()) {
    return [];
  }

  return content
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as StagedResourceRecord);
}

function ensurePatient(
  map: Map<string, NormalizedPatientContext>,
  patientId: string,
  runId: string,
  profileVersion: string,
  generatedAt: string
): NormalizedPatientContext {
  const existing = map.get(patientId);
  if (existing) {
    return existing;
  }

  const created: NormalizedPatientContext = {
    patientId,
    profileVersion,
    sourceRunId: runId,
    generatedAt,
    activeConditions: [],
    activeMedications: [],
    careTasks: [],
    upcomingAppointments: [],
    observations: [],
    sdohFlags: []
  };

  map.set(patientId, created);
  return created;
}

function recordValidationFailure(
  target: NormalizationValidationFailure[],
  runId: string,
  category: string,
  record: StagedResourceRecord,
  issues: ValidationIssue[],
  patientId: string | null = null
) {
  if (issues.length === 0) {
    return;
  }

  target.push({
    runId,
    patientId,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    category,
    sourceFile: record.sourceFile,
    issues,
    recordedAt: isoNow()
  });
}

function validateActiveCondition(condition: ActiveCondition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isMissingText(condition.conditionId)) {
    issues.push(createIssue("activeConditions[].conditionId", "Condition identifier is required."));
  }

  if (isMissingText(condition.codeText)) {
    issues.push(createIssue("activeConditions[].codeText", "Condition code text is required."));
  }

  if (isMissingText(condition.clinicalStatus)) {
    issues.push(createIssue("activeConditions[].clinicalStatus", "Condition clinical status is required."));
  }

  return issues;
}

function validateActiveMedication(medication: ActiveMedication): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isMissingText(medication.medicationId)) {
    issues.push(createIssue("activeMedications[].medicationId", "Medication identifier is required."));
  }

  if (isMissingText(medication.name)) {
    issues.push(createIssue("activeMedications[].name", "Medication name is required."));
  }

  if (isMissingText(medication.status)) {
    issues.push(createIssue("activeMedications[].status", "Medication status is required."));
  }

  return issues;
}

function validateCareTask(task: CareTask): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isMissingText(task.carePlanId)) {
    issues.push(createIssue("careTasks[].carePlanId", "Care plan identifier is required."));
  }

  if (isMissingText(task.description)) {
    issues.push(createIssue("careTasks[].description", "Care task description is required."));
  }

  return issues;
}

function validateUpcomingAppointment(appointment: UpcomingAppointment): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isMissingText(appointment.encounterId)) {
    issues.push(createIssue("upcomingAppointments[].encounterId", "Encounter identifier is required."));
  }

  if (isMissingText(appointment.start)) {
    issues.push(createIssue("upcomingAppointments[].start", "Appointment start datetime is required."));
  }

  return issues;
}

function validateObservation(observation: RelevantObservation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isMissingText(observation.observationId)) {
    issues.push(createIssue("observations[].observationId", "Observation identifier is required."));
  }

  if (isMissingText(observation.codeText)) {
    issues.push(createIssue("observations[].codeText", "Observation code text is required."));
  }

  if (isMissingText(observation.valueText)) {
    issues.push(createIssue("observations[].valueText", "Observation value is required."));
  }

  return issues;
}

function validateSdohFlag(flag: SdohFlag): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (isMissingText(flag.observationId)) {
    issues.push(createIssue("sdohFlags[].observationId", "SDOH observation identifier is required."));
  }

  if (isMissingText(flag.flag)) {
    issues.push(createIssue("sdohFlags[].flag", "SDOH flag label is required."));
  }

  if (isMissingText(flag.value)) {
    issues.push(createIssue("sdohFlags[].value", "SDOH value is required."));
  }

  return issues;
}

export async function normalizeFhirStagedRun(
  options: FhirNormalizationOptions
): Promise<FhirNormalizationSummary> {
  const stagedRootPath =
    options.stagedRootPath ?? path.join(".propel", "context", "data", "staging", "raw-fhir");
  const outputRootPath =
    options.outputRootPath ?? path.join(".propel", "context", "data", "normalized", "patient-context");
  const profileVersion = options.profileVersion ?? "v1";
  const generatedAt = isoNow();

  const stagedDirectory = path.join(stagedRootPath, options.runId);
  const outputDirectory = path.join(outputRootPath, options.runId);
  const outputPatientsDirectory = path.join(outputDirectory, "patients");
  const duplicateEventsPath = path.join(outputDirectory, "duplicate-events.json");
  const lineagePath = path.join(outputDirectory, "lineage-metadata.ndjson");
  const lineageQualityReportPath = path.join(outputDirectory, "lineage-quality-report.json");
  const reprocessingHistoryPath = path.join(outputRootPath, "reprocessing-history.ndjson");

  await mkdir(outputPatientsDirectory, { recursive: true });

  const recordsByType = new Map<(typeof REQUIRED_FHIR_RESOURCE_TYPES)[number], StagedResourceRecord[]>();
  for (const type of REQUIRED_FHIR_RESOURCE_TYPES) {
    const filePath = path.join(stagedDirectory, `${type}.ndjson`);
    recordsByType.set(type, await readNdjsonRecords(filePath));
  }

  const contexts = new Map<string, NormalizedPatientContext>();
  const validationFailures: NormalizationValidationFailure[] = [];
  const duplicateEvents: NormalizationDuplicateEvent[] = [];
  const lineageEntries: NormalizationLineageEntry[] = [];
  const seenIdempotencyKeys = new Set<string>();

  for (const patientRecord of recordsByType.get("Patient") ?? []) {
    const patient = patientRecord.payload;
    const patientId = patient.id ?? patientRecord.resourceId;
    ensurePatient(contexts, patientId, options.runId, profileVersion, generatedAt);
  }

  for (const record of recordsByType.get("Condition") ?? []) {
    const resource = record.payload;
    const patientId = referencePatientId(resource.subject);
    if (!patientId) {
      recordValidationFailure(validationFailures, options.runId, "activeConditions", record, [
        createIssue("subject.reference", "Patient reference is required for condition normalization.")
      ]);
      continue;
    }

    if (!isConditionActive(resource)) {
      continue;
    }

    const normalizedCondition: ActiveCondition = {
      conditionId: resource.id ?? record.resourceId,
      codeText: getConceptText(resource.code),
      clinicalStatus: clinicalStatus(resource),
      onsetDate: typeof resource.onsetDateTime === "string" ? resource.onsetDateTime : null
    };

    const conditionIssues = validateActiveCondition(normalizedCondition);
    if (conditionIssues.length > 0) {
      recordValidationFailure(validationFailures, options.runId, "activeConditions", record, conditionIssues, patientId);
      continue;
    }

    const conditionKey = idempotencyKey(patientId, "activeConditions", normalizedCondition.conditionId);
    if (seenIdempotencyKeys.has(conditionKey)) {
      duplicateEvents.push({
        runId: options.runId,
        patientId,
        entityType: "activeConditions",
        idempotencyKey: conditionKey,
        reason: "Duplicate normalized condition suppressed during upsert.",
        detectedAt: isoNow()
      });
      continue;
    }

    seenIdempotencyKeys.add(conditionKey);

    const context = ensurePatient(contexts, patientId, options.runId, profileVersion, generatedAt);
    context.activeConditions.push(normalizedCondition);
    recordLineageEntry(
      lineageEntries,
      record,
      patientId,
      "activeConditions",
      normalizedCondition.conditionId,
      profileVersion
    );
  }

  for (const record of recordsByType.get("MedicationRequest") ?? []) {
    const resource = record.payload;
    const patientId = referencePatientId(resource.subject);
    if (!patientId) {
      recordValidationFailure(validationFailures, options.runId, "activeMedications", record, [
        createIssue("subject.reference", "Patient reference is required for medication normalization.")
      ]);
      continue;
    }

    const status = medicationStatus(resource).toLowerCase();
    if (status !== "active") {
      continue;
    }

    const normalizedMedication: ActiveMedication = {
      medicationId: resource.id ?? record.resourceId,
      name: getConceptText(resource.medicationCodeableConcept),
      doseText: extractDoseText(resource),
      scheduleText: extractScheduleText(resource),
      status: medicationStatus(resource),
      authoredOn: typeof resource.authoredOn === "string" ? resource.authoredOn : null
    };

    const medicationIssues = validateActiveMedication(normalizedMedication);
    if (medicationIssues.length > 0) {
      recordValidationFailure(validationFailures, options.runId, "activeMedications", record, medicationIssues, patientId);
      continue;
    }

    const medicationKey = idempotencyKey(patientId, "activeMedications", normalizedMedication.medicationId);
    if (seenIdempotencyKeys.has(medicationKey)) {
      duplicateEvents.push({
        runId: options.runId,
        patientId,
        entityType: "activeMedications",
        idempotencyKey: medicationKey,
        reason: "Duplicate normalized medication suppressed during upsert.",
        detectedAt: isoNow()
      });
      continue;
    }

    seenIdempotencyKeys.add(medicationKey);

    const context = ensurePatient(contexts, patientId, options.runId, profileVersion, generatedAt);
    context.activeMedications.push(normalizedMedication);
    recordLineageEntry(
      lineageEntries,
      record,
      patientId,
      "activeMedications",
      normalizedMedication.medicationId,
      profileVersion
    );
  }

  for (const record of recordsByType.get("CarePlan") ?? []) {
    const resource = record.payload;
    const patientId = referencePatientId(resource.subject);
    if (!patientId) {
      recordValidationFailure(validationFailures, options.runId, "careTasks", record, [
        createIssue("subject.reference", "Patient reference is required for care task normalization.")
      ]);
      continue;
    }

    const normalizedTask = extractCarePlanTask(resource);
    const taskIssues = validateCareTask(normalizedTask);
    if (taskIssues.length > 0) {
      recordValidationFailure(validationFailures, options.runId, "careTasks", record, taskIssues, patientId);
      continue;
    }

    const taskKey = idempotencyKey(patientId, "careTasks", normalizedTask.carePlanId);
    if (seenIdempotencyKeys.has(taskKey)) {
      duplicateEvents.push({
        runId: options.runId,
        patientId,
        entityType: "careTasks",
        idempotencyKey: taskKey,
        reason: "Duplicate normalized care task suppressed during upsert.",
        detectedAt: isoNow()
      });
      continue;
    }

    seenIdempotencyKeys.add(taskKey);

    const context = ensurePatient(contexts, patientId, options.runId, profileVersion, generatedAt);
    context.careTasks.push(normalizedTask);
    recordLineageEntry(
      lineageEntries,
      record,
      patientId,
      "careTasks",
      normalizedTask.carePlanId,
      profileVersion
    );
  }

  for (const record of recordsByType.get("Encounter") ?? []) {
    const resource = record.payload;
    const patientId = referencePatientId(resource.subject);
    if (!patientId) {
      recordValidationFailure(validationFailures, options.runId, "upcomingAppointments", record, [
        createIssue("subject.reference", "Patient reference is required for encounter normalization.")
      ]);
      continue;
    }

    const start = extractEncounterDate(resource.period);
    if (!isFutureOrToday(start)) {
      continue;
    }

    const period = (resource.period as { start?: string; end?: string } | undefined) ?? {};
    const normalizedAppointment: UpcomingAppointment = {
      encounterId: resource.id ?? record.resourceId,
      classText: getConceptText(resource.type),
      status: typeof resource.status === "string" ? resource.status : "unknown",
      start: period.start ?? null,
      end: period.end ?? null
    };

    const appointmentIssues = validateUpcomingAppointment(normalizedAppointment);
    if (appointmentIssues.length > 0) {
      recordValidationFailure(
        validationFailures,
        options.runId,
        "upcomingAppointments",
        record,
        appointmentIssues,
        patientId
      );
      continue;
    }

    const appointmentKey = idempotencyKey(
      patientId,
      "upcomingAppointments",
      normalizedAppointment.encounterId
    );
    if (seenIdempotencyKeys.has(appointmentKey)) {
      duplicateEvents.push({
        runId: options.runId,
        patientId,
        entityType: "upcomingAppointments",
        idempotencyKey: appointmentKey,
        reason: "Duplicate normalized appointment suppressed during upsert.",
        detectedAt: isoNow()
      });
      continue;
    }

    seenIdempotencyKeys.add(appointmentKey);

    const context = ensurePatient(contexts, patientId, options.runId, profileVersion, generatedAt);
    context.upcomingAppointments.push(normalizedAppointment);
    recordLineageEntry(
      lineageEntries,
      record,
      patientId,
      "upcomingAppointments",
      normalizedAppointment.encounterId,
      profileVersion
    );
  }

  for (const record of recordsByType.get("Observation") ?? []) {
    const resource = record.payload;
    const patientId = referencePatientId(resource.subject);
    if (!patientId) {
      recordValidationFailure(validationFailures, options.runId, "observations", record, [
        createIssue("subject.reference", "Patient reference is required for observation normalization.")
      ]);
      continue;
    }

    const issued = typeof resource.issued === "string" ? resource.issued : null;
    const normalizedObservation: RelevantObservation = {
      observationId: resource.id ?? record.resourceId,
      codeText: getConceptText(resource.code),
      valueText: extractObservationValue(resource),
      issued
    };

    const observationIssues = validateObservation(normalizedObservation);
    if (observationIssues.length > 0) {
      recordValidationFailure(validationFailures, options.runId, "observations", record, observationIssues, patientId);
      continue;
    }

    const observationKey = idempotencyKey(patientId, "observations", normalizedObservation.observationId);
    if (seenIdempotencyKeys.has(observationKey)) {
      duplicateEvents.push({
        runId: options.runId,
        patientId,
        entityType: "observations",
        idempotencyKey: observationKey,
        reason: "Duplicate normalized observation suppressed during upsert.",
        detectedAt: isoNow()
      });
      continue;
    }

    seenIdempotencyKeys.add(observationKey);

    const context = ensurePatient(contexts, patientId, options.runId, profileVersion, generatedAt);

    context.observations.push(normalizedObservation);
    recordLineageEntry(
      lineageEntries,
      record,
      patientId,
      "observations",
      normalizedObservation.observationId,
      profileVersion
    );

    if (isSdohObservation(resource)) {
      const normalizedFlag: SdohFlag = {
        observationId: normalizedObservation.observationId,
        flag: normalizedObservation.codeText,
        value: normalizedObservation.valueText,
        recordedAt: issued
      };

      const flagIssues = validateSdohFlag(normalizedFlag);
      if (flagIssues.length > 0) {
        recordValidationFailure(validationFailures, options.runId, "sdohFlags", record, flagIssues, patientId);
        continue;
      }

      const sdohKey = idempotencyKey(patientId, "sdohFlags", normalizedFlag.observationId);
      if (seenIdempotencyKeys.has(sdohKey)) {
        duplicateEvents.push({
          runId: options.runId,
          patientId,
          entityType: "sdohFlags",
          idempotencyKey: sdohKey,
          reason: "Duplicate normalized SDOH flag suppressed during upsert.",
          detectedAt: isoNow()
        });
        continue;
      }

      seenIdempotencyKeys.add(sdohKey);

      context.sdohFlags.push(normalizedFlag);
      recordLineageEntry(
        lineageEntries,
        record,
        patientId,
        "sdohFlags",
        normalizedFlag.observationId,
        profileVersion
      );
    }
  }

  const outputFiles: string[] = [];

  for (const [patientId, context] of contexts.entries()) {
    context.upcomingAppointments.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
    context.observations.sort((a, b) => (b.issued ?? "").localeCompare(a.issued ?? ""));

    const patientPath = path.join(outputPatientsDirectory, `${patientId}.json`);
    await writeFile(patientPath, JSON.stringify(context, null, 2), "utf8");
    outputFiles.push(patientPath);
  }

  const failuresByCategory: Record<string, number> = {};
  const failuresByResourceType = buildFailuresByResourceType();

  for (const failure of validationFailures) {
    failuresByCategory[failure.category] = (failuresByCategory[failure.category] ?? 0) + 1;
    failuresByResourceType[failure.resourceType] += 1;
  }

  const lineageQualityReport = buildLineageQualityReport(options.runId, contexts, lineageEntries);
  for (const missing of lineageQualityReport.missingEntries) {
    const resourceType = resourceTypeFromEntityType(missing.targetEntityType);
    const failureRecord: StagedResourceRecord = {
      runId: options.runId,
      sourceFile: lineagePath,
      resourceType,
      resourceId: missing.targetEntityId,
      ingestedAt: generatedAt,
      payload: { resourceType, id: missing.targetEntityId }
    };

    recordValidationFailure(
      validationFailures,
      options.runId,
      "lineage",
      failureRecord,
      [createIssue("lineage.idempotencyKey", `Missing lineage entry for ${missing.idempotencyKey}.`)],
      missing.patientId
    );

    failuresByCategory.lineage = (failuresByCategory.lineage ?? 0) + 1;
    failuresByResourceType[resourceType] += 1;
  }

  const validationReportPath = path.join(outputDirectory, "validation-errors.json");
  const validationReport: NormalizationValidationReport = {
    runId: options.runId,
    generatedAt,
    totalFailures: validationFailures.length,
    failuresByCategory,
    failuresByResourceType,
    failures: validationFailures
  };

  await writeFile(validationReportPath, JSON.stringify(validationReport, null, 2), "utf8");
  await writeFile(duplicateEventsPath, JSON.stringify(duplicateEvents, null, 2), "utf8");
  await writeNdjsonLines(lineagePath, lineageEntries);
  await writeFile(lineageQualityReportPath, JSON.stringify(lineageQualityReport, null, 2), "utf8");

  const historyEntry: NormalizationReprocessingHistoryEntry = {
    runId: options.runId,
    profileVersion,
    stagedDirectory,
    outputDirectory,
    patientCount: contexts.size,
    generatedAt,
    validationFailureCount: validationFailures.length,
    duplicateEventCount: duplicateEvents.length
  };

  await appendNdjsonLine(reprocessingHistoryPath, historyEntry);

  const summary: FhirNormalizationSummary = {
    runId: options.runId,
    stagedDirectory,
    outputDirectory,
    patientCount: contexts.size,
    outputFiles,
    profileVersion,
    generatedAt,
    validationReportPath,
    validationFailureCount: validationFailures.length,
    validationFailuresByCategory: failuresByCategory,
    duplicateEventCount: duplicateEvents.length,
    duplicateEventsPath,
    idempotencyHistoryPath: reprocessingHistoryPath,
    lineagePath,
    lineageCount: lineageEntries.length,
    lineageQualityReportPath,
    missingLineageCount: lineageQualityReport.totalMissing
  };

  await writeFile(path.join(outputDirectory, "normalization-summary.json"), JSON.stringify(summary, null, 2), "utf8");

  return summary;
}

export async function queryNormalizationReprocessingHistory(
  runId: string,
  outputRootPath = path.join(".propel", "context", "data", "normalized", "patient-context")
): Promise<NormalizationReprocessingHistoryEntry[]> {
  const reprocessingHistoryPath = path.join(outputRootPath, "reprocessing-history.ndjson");
  const entries = await readNdjsonLines<NormalizationReprocessingHistoryEntry>(reprocessingHistoryPath);
  return entries.filter((entry) => entry.runId === runId);
}

export type QueryNormalizationLineageOptions = {
  runId: string;
  patientId?: string;
  targetEntityType?: NormalizedEntityType;
  targetEntityId?: string;
  outputRootPath?: string;
};

export async function queryNormalizationLineage(
  options: QueryNormalizationLineageOptions
): Promise<NormalizationLineageEntry[]> {
  const outputRootPath = options.outputRootPath ?? path.join(".propel", "context", "data", "normalized", "patient-context");
  const lineagePath = path.join(outputRootPath, options.runId, "lineage-metadata.ndjson");
  const entries = await readNdjsonLines<NormalizationLineageEntry>(lineagePath);

  return entries.filter((entry) => {
    if (options.patientId && entry.patientId !== options.patientId) {
      return false;
    }

    if (options.targetEntityType && entry.targetEntityType !== options.targetEntityType) {
      return false;
    }

    if (options.targetEntityId && entry.targetEntityId !== options.targetEntityId) {
      return false;
    }

    return true;
  });
}

export async function validateLineageCoverageForRun(
  runId: string,
  outputRootPath = path.join(".propel", "context", "data", "normalized", "patient-context")
): Promise<NormalizationLineageQualityReport> {
  const runDirectory = path.join(outputRootPath, runId);
  const summaryPath = path.join(runDirectory, "normalization-summary.json");
  const summaryContent = await readFile(summaryPath, "utf8").catch(() => "");
  if (!summaryContent.trim()) {
    return {
      runId,
      generatedAt: isoNow(),
      totalExpected: 0,
      totalRecorded: 0,
      totalMissing: 0,
      missingEntries: []
    };
  }

  const summary = JSON.parse(summaryContent) as FhirNormalizationSummary;
  const contexts = new Map<string, NormalizedPatientContext>();
  for (const outputPath of summary.outputFiles) {
    const content = await readFile(outputPath, "utf8");
    const context = JSON.parse(content) as NormalizedPatientContext;
    contexts.set(context.patientId, context);
  }

  const lineageEntries = await queryNormalizationLineage({ runId, outputRootPath });
  return buildLineageQualityReport(runId, contexts, lineageEntries);
}
