
import { IJobPayload } from "../models/Event";

export interface JobEvent {
  tenantId: string;
  sourceId: string;
  eventId: string;
  externalJobId: string;
  version: number;
  operation: "upsert" | "archive";
  payload?: IJobPayload;
}

type ValidationResult =
  | { valid: true; data: JobEvent }
  | { valid: false; error: string };

const isObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
};

const hasOnlyFields = (
  data: Record<string, unknown>,
  allowed: string[]
): boolean => {
  return Object.keys(data).every((key) => allowed.includes(key));
};

export const validateEvent = (input: unknown): ValidationResult => {
  if (!isObject(input)) {
    return { valid: false, error: "Event must be a JSON object" };
  }

  const allowedFields = [
    "tenantId",
    "sourceId",
    "eventId",
    "externalJobId",
    "version",
    "operation",
    "payload"
  ];

  if (!hasOnlyFields(input, allowedFields)) {
    return { valid: false, error: "Unknown event field" };
  }

  // Validate identifiers
  const identifiers = [
    "tenantId",
    "sourceId",
    "eventId",
    "externalJobId"
  ] as const;

  for (const field of identifiers) {
    const value = input[field];

    if (
      typeof value !== "string" ||
      value.trim() === "" ||
      value !== value.trim()
    ) {
      return {
        valid: false,
        error: `Invalid ${field}`
      };
    }
  }

  // Validate version
  if (
    typeof input.version !== "number" ||
    !Number.isSafeInteger(input.version) ||
    input.version <= 0
  ) {
    return {
      valid: false,
      error: "Version must be a positive safe integer"
    };
  }

  // Validate operation
  if (input.operation !== "upsert" && input.operation !== "archive") {
    return {
      valid: false,
      error: "Operation must be upsert or archive"
    };
  }

  const event: JobEvent = {
    tenantId: input.tenantId as string,
    sourceId: input.sourceId as string,
    eventId: input.eventId as string,
    externalJobId: input.externalJobId as string,
    version: input.version,
    operation: input.operation
  };

  // Archive events must not contain payload
  if (input.operation === "archive") {
    if (Object.prototype.hasOwnProperty.call(input, "payload")) {
      return {
        valid: false,
        error: "Archive event must not contain payload"
      };
    }

    return { valid: true, data: event };
  }

  // Upsert requires payload
  if (!isObject(input.payload)) {
    return {
      valid: false,
      error: "Payload is required for upsert"
    };
  }

  const payload = input.payload;

  const payloadFields = [
    "title",
    "company",
    "location",
    "experienceMin",
    "experienceMax",
    "applyUrl",
    "skills"
  ];

  if (!hasOnlyFields(payload, payloadFields)) {
    return {
      valid: false,
      error: "Unknown payload field"
    };
  }

  // Validate display strings
  for (const field of ["title", "company", "location"] as const) {
    if (
      typeof payload[field] !== "string" ||
      payload[field].trim() === ""
    ) {
      return {
        valid: false,
        error: `Invalid ${field}`
      };
    }
  }

  // Validate experience
  const min = payload.experienceMin;
  const max = payload.experienceMax;

  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min < 0 ||
    max > 50 ||
    min > max
  ) {
    return {
      valid: false,
      error: "Invalid experience range"
    };
  }

  // Validate HTTPS URL
  if (typeof payload.applyUrl !== "string") {
    return {
      valid: false,
      error: "Invalid applyUrl"
    };
  }

  try {
    const url = new URL(payload.applyUrl);

    if (url.protocol !== "https:" || !url.hostname) {
      return {
        valid: false,
        error: "applyUrl must use HTTPS"
      };
    }
  } catch {
    return {
      valid: false,
      error: "Invalid applyUrl"
    };
  }

  // Validate and normalize skills
  if (
    !Array.isArray(payload.skills) ||
    !payload.skills.every(
      (skill) =>
        typeof skill === "string" &&
        skill.trim() !== ""
    )
  ) {
    return {
      valid: false,
      error: "Skills must be an array of nonblank strings"
    };
  }

  const skills = [
    ...new Set(
      (payload.skills as string[]).map((skill) =>
        skill.trim().toLowerCase()
      )
    )
  ];

  event.payload = {
    title: (payload.title as string).trim(),
    company: (payload.company as string).trim(),
    location: (payload.location as string).trim(),
    experienceMin: min,
    experienceMax: max,
    applyUrl: payload.applyUrl,
    skills
  };

  return { valid: true, data: event };
};
