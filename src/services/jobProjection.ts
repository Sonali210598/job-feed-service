
import Job from "../models/Job";
import type { ClientSession } from "mongoose";

interface ProjectionEvent {
  tenantId: string;
  sourceId: string;
  externalJobId: string;
  version: number;
  operation: "upsert" | "archive";
  payload?: {
    title: string;
    company: string;
    location: string;
    experienceMin: number;
    experienceMax: number;
    applyUrl: string;
    skills: string[];
  };
}

export const applyJobProjection = async (
  event: ProjectionEvent,
  session?: ClientSession
): Promise<"applied" | "stale"> => {
  const identity = {
    tenantId: event.tenantId,
    sourceId: event.sourceId,
    externalJobId: event.externalJobId
  };

  // Build the job data
  const update =
    event.operation === "archive"
      ? {
          version: event.version,
          status: "archived" as const,
          title: null,
          company: null,
          location: null,
          experienceMin: null,
          experienceMax: null,
          applyUrl: null,
          skills: []
        }
      : {
          version: event.version,
          status: "active" as const,
          ...event.payload
        };

  if (event.operation === "upsert" && !event.payload) {
    throw new Error("Upsert event requires a payload");
  }

  // First try to update an existing older job
  const updated = await Job.updateOne(
    {
      ...identity,
      version: { $lt: event.version }
    },
    {
      $set: update
    },
    { session }
  );

  if (updated.modifiedCount === 1) {
    return "applied";
  }

  // Check whether the job already exists
  const existing = await Job.findOne(identity)
    .select("version")
    .session(session ?? null)
    .lean();

  if (existing) {
    return "stale";
  }

  // No job exists: create one
  try {
    await Job.create([{
      ...identity,
      ...update
    }], { session });

    return "applied";
  } catch (error: unknown) {
    // Another worker may have inserted the job.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      // Retry the conditional update in case the
      // other worker inserted a lower version.
      if (session) throw error; // Retry the whole transaction.
      const retry = await Job.updateOne(
        {
          ...identity,
          version: { $lt: event.version }
        },
        {
          $set: update
        }
      );

      return retry.modifiedCount === 1
        ? "applied"
        : "stale";
    }

    throw error;
  }
};
