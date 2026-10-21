
import mongoose, { Schema } from "mongoose";

export interface IJobPayload {
  title: string;
  company: string;
  location: string;
  experienceMin: number;
  experienceMax: number;
  applyUrl: string;
  skills: string[];
}

export interface IEvent  {
  tenantId: string;
  sourceId: string;
  eventId: string;
  externalJobId: string;
  version: number;
  operation: "upsert" | "archive";
  payload?: IJobPayload;

  rawEvent: Record<string, unknown>;

  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;

  attemptHistory: {
    attempt: number;
    error?: string;
    createdAt: Date;
  }[];

  lastError?: string;
  nextAttemptAt: Date;

  lockedBy?: string;
  lockedUntil?: Date;
}

const payloadSchema = new Schema(
  {
    title: String,
    company: String,
    location: String,
    experienceMin: Number,
    experienceMax: Number,
    applyUrl: String,
    skills: [String]
  },
  { _id: false }
);

const eventSchema = new Schema<IEvent>(
  {
    tenantId: { type: String, required: true },
    sourceId: { type: String, required: true },
    eventId: { type: String, required: true },
    externalJobId: { type: String, required: true },

    version: { type: Number, required: true },

    operation: {
      type: String,
      enum: ["upsert", "archive"],
      required: true
    },

    payload: payloadSchema,

    rawEvent: {
      type: Schema.Types.Mixed,
      required: true
    },

    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending"
    },

    attempts: {
      type: Number,
      default: 0
    },

    attemptHistory: [
      {
        _id: false,
        attempt: Number,
        error: String,
        createdAt: Date
      }
    ],

    lastError: String,

    nextAttemptAt: {
      type: Date,
      default: Date.now
    },

    lockedBy: String,
    lockedUntil: Date
  },
  { timestamps: true }
);

// Prevent duplicate event identities

eventSchema.index(
    { tenantId: 1, sourceId: 1, eventId: 1 },
    {
      unique: true,
      name: "unique_event_identity"
    }
  );
  
// Help workers find pending events
eventSchema.index({
  status: 1,
  nextAttemptAt: 1,
  lockedUntil: 1
});

const Event = mongoose.model("Event", eventSchema);

export default Event;
