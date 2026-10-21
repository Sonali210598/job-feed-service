
import "dotenv/config";
import mongoose from "mongoose";
import Event from "../src/models/Event";
import {
  claimNextEvent,
  processEvent
} from "../src/workers/eventWorker";

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const runTest = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);

    // Use an existing disposable event.
    // Set TEST_EVENT_ID to the event you want to test.
    const eventId = process.env.TEST_EVENT_ID;

    if (!eventId) {
      throw new Error(
        "Set TEST_EVENT_ID before running this test"
      );
    }

    for (let i = 0; i < 12; i++) {
      const existing = await Event.findOne({ eventId });

      if (!existing) {
        throw new Error("Test event not found");
      }

      if (
        existing.status === "completed" ||
        existing.status === "failed"
      ) {
        console.log("Final status:", existing.status);
        console.log("Attempts:", existing.attempts);
        console.log("History:", existing.attemptHistory);
        return;
      }

      const claimed = await claimNextEvent();

      if (claimed) {
        await processEvent(claimed);
      }

      await sleep(1000);
    }

    const finalEvent = await Event.findOne({ eventId });

    console.log("Current status:", finalEvent?.status);
    console.log("Attempts:", finalEvent?.attempts);
    console.log("History:", finalEvent?.attemptHistory);

  } catch (error) {
    console.error("Worker test error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

runTest();
