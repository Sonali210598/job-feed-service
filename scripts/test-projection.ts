
import "dotenv/config";
import mongoose from "mongoose";
import Job from "../src/models/Job";
import { applyJobProjection } from "../src/services/jobProjection";

const identity = {
  tenantId: "projection-test",
  sourceId: "main",
  externalJobId: "job-001"
};

const payload = {
  title: "MERN Developer",
  company: "Example Company",
  location: "Surat",
  experienceMin: 1,
  experienceMax: 3,
  applyUrl: "https://example.test/jobs/1",
  skills: ["react", "nodejs"]
};

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    // Test 1: Insert version 1
    console.log(
      "Version 1:",
      await applyJobProjection({
        ...identity,
        version: 1,
        operation: "upsert",
        payload
      })
    );

    // Test 2: Update to version 3
    console.log(
      "Version 3:",
      await applyJobProjection({
        ...identity,
        version: 3,
        operation: "upsert",
        payload: {
          ...payload,
          title: "Senior MERN Developer"
        }
      })
    );

    // Test 3: Older archive must be ignored
    console.log(
      "Version 2 archive:",
      await applyJobProjection({
        ...identity,
        version: 2,
        operation: "archive"
      })
    );

    // Test 4: Newer archive
    console.log(
      "Version 5 archive:",
      await applyJobProjection({
        ...identity,
        version: 5,
        operation: "archive"
      })
    );

    // Test 5: Older upsert cannot restore it
    console.log(
      "Version 4 upsert:",
      await applyJobProjection({
        ...identity,
        version: 4,
        operation: "upsert",
        payload
      })
    );

    const finalJob = await Job.findOne(identity).lean();

    console.log("Final job:", {
      version: finalJob?.version,
      status: finalJob?.status
    });

  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
