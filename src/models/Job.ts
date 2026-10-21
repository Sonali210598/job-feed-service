
import mongoose, { Schema } from "mongoose";

export interface IJob {
  tenantId: string;
  sourceId: string;
  externalJobId: string;

  version: number;
  status: "active" | "archived";

  title?: string;
  company?: string;
  location?: string;
  experienceMin?: number;
  experienceMax?: number;
  applyUrl?: string;
  skills?: string[];
}

const jobSchema = new Schema<IJob>(
  {
    tenantId: {
      type: String,
      required: true
    },

    sourceId: {
      type: String,
      required: true
    },

    externalJobId: {
      type: String,
      required: true
    },

    version: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      enum: ["active", "archived"],
      required: true
    },

    title: String,
    company: String,
    location: String,
    experienceMin: Number,
    experienceMax: Number,
    applyUrl: String,
    skills: [String]
  },
  { timestamps: true }
);

// Only one record per logical job
jobSchema.index({
  tenantId: 1,
  sourceId: 1,
  status: 1,
  _id: 1
});
// Support tenant-scoped job listing
jobSchema.index({
  tenantId: 1,
  status: 1,
  sourceId: 1,
  _id: 1
});

const Job = mongoose.model("Job", jobSchema);

export default Job;
