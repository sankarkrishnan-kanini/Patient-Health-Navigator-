import { AppError } from "@/lib/errors";

export type AuditValidationIssue = {
  field: string;
  issue: "missing" | "invalid";
  message: string;
};

export type AuditValidationDetails = {
  fields: AuditValidationIssue[];
};

export function createAuditValidationError(
  code: string,
  message: string,
  fields: AuditValidationIssue[]
): AppError {
  return new AppError(code, message, 400, { fields });
}

export function validateRequiredStringField(
  value: unknown,
  fieldName: string
): AuditValidationIssue | null {
  if (value === undefined || value === null) {
    return {
      field: fieldName,
      issue: "missing",
      message: `${fieldName} is required.`
    };
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return {
      field: fieldName,
      issue: "invalid",
      message: `${fieldName} must be a non-empty string.`
    };
  }

  return null;
}

export function validateRequiredBooleanField(
  value: unknown,
  fieldName: string
): AuditValidationIssue | null {
  if (value === undefined || value === null) {
    return {
      field: fieldName,
      issue: "missing",
      message: `${fieldName} is required.`
    };
  }

  if (typeof value !== "boolean") {
    return {
      field: fieldName,
      issue: "invalid",
      message: `${fieldName} must be a boolean.`
    };
  }

  return null;
}

export function validateRequiredStringArrayField(
  value: unknown,
  fieldName: string
): AuditValidationIssue | null {
  if (value === undefined || value === null) {
    return {
      field: fieldName,
      issue: "missing",
      message: `${fieldName} is required.`
    };
  }

  if (!Array.isArray(value) || value.length === 0) {
    return {
      field: fieldName,
      issue: "invalid",
      message: `${fieldName} must be a non-empty array of non-empty strings.`
    };
  }

  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) {
      return {
        field: fieldName,
        issue: "invalid",
        message: `${fieldName} must be a non-empty array of non-empty strings.`
      };
    }
  }

  return null;
}

export function validateRequiredEnumField<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[]
): AuditValidationIssue | null {
  const stringIssue = validateRequiredStringField(value, fieldName);
  if (stringIssue !== null) {
    return stringIssue;
  }

  if (!allowedValues.includes(value as T)) {
    return {
      field: fieldName,
      issue: "invalid",
      message: `${fieldName} must be one of: ${allowedValues.join(", ")}.`
    };
  }

  return null;
}