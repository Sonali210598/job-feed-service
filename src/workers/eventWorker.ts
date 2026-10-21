
import { randomUUID } from "node:crypto";
import Event from "../models/Event";
import { verifyWithProvider } from "../services/fakeProvider";
import { applyJobProjection } from "../services/jobProjection";

const LEASE_MS = 30_000;
const MAX_ATTEMPTS = 3;

const RETRY_BASE_MS = Number(
  process.env.RETRY_BASE_MS ?? 2000
);

if (!Number.isFinite(RETRY_BASE_MS) || RETRY_BASE_MS <= 0) {
  throw new Error("RETRY_BASE_MS must be positive");
}

// Claim an event atomically
export const claimNextEvent = async () => {
  const now = new Date();

  const workerToken = randomUUID();

  return Event.findOneAndUpdate(
    {
      $or: [
        {
          status: "pending",
          nextAttemptAt: { $lte: now }
        },
        {
          status: "processing",
          lockedUntil: { $lte: now }
        }
      ]
    },
    {
      $set: {
        status: "processing",
        lockedBy: workerToken,
        lockedUntil: new Date(
          now.getTime() + LEASE_MS
        )
      }
    },
    {
      new: true,
      sort: { nextAttemptAt: 1, _id: 1 }
    }
  );
};

// Process one claimed event
export const processEvent = async (
  event: NonNullable<
    Awaited<ReturnType<typeof claimNextEvent>>
  >
): Promise<void> => {
  const token = event.lockedBy;

  if (!token) {
    throw new Error("Claimed event has no lock token");
  }

  // All event updates must still own the lease
  const ownedFilter = () => ({
    _id: event._id,
    status: "processing",
    lockedBy: token,
    lockedUntil: { $gt: new Date() }
  });

  // If the worker crashed after its third attempt,
  // don't make a fourth provider call.
  if (event.attempts >= MAX_ATTEMPTS) {
    await Event.updateOne(ownedFilter(), {
      $set: {
        status: "failed",
        lastError: event.lastError ??
          "Maximum attempts reached"
      },
      $unset: {
        lockedBy: "",
        lockedUntil: ""
      }
    });

    return;
  }

  const attempt = event.attempts + 1;

  // Persist the attempt BEFORE calling the provider.
  const started = await Event.updateOne(
    ownedFilter(),
    {
      $set: { attempts: attempt },
      $push: {
        attemptHistory: {
          attempt,
          createdAt: new Date()
        }
      }
    }
  );

  if (started.modifiedCount !== 1) {
    console.log("Lease lost before verification");
    return;
  }

  try {
    const result = await verifyWithProvider(
      event.eventId,
      attempt
    );

    // Successful verification: leave processing until
    // Step 10.3 applies the job projection safely.
 
if (result.success) {
    // Verify that this worker still owns the event.
    const owned = await Event.exists(ownedFilter());
  
    if (!owned) {
      console.log("Lease lost before job update");
      return;
    }
  
    // Apply the job only if its version is newer.
    const projectionResult = await applyJobProjection({
      tenantId: event.tenantId,
      sourceId: event.sourceId,
      externalJobId: event.externalJobId,
      version: event.version,
      operation: event.operation,
      payload: event.payload
    });
  
    // Mark the event completed after the job update.
    const acknowledged = await Event.updateOne(
      ownedFilter(),
      {
        $set: {
          status: "completed"
        },
        $unset: {
          lockedBy: "",
          lockedUntil: "",
          lastError: ""
        }
      }
    );
  
    if (acknowledged.modifiedCount !== 1) {
      console.log(
        "Job updated but event acknowledgement lost"
      );
      return;
    }
  
    console.log(
      `Event completed: ${event.eventId}, ${projectionResult}`
    );
  
    return;
  }  

    const errorMessage = result.message;

    const retryable =
      result.statusCode === 429 ||
      result.statusCode === 503;

    const shouldRetry =
      retryable && attempt < MAX_ATTEMPTS;

    if (shouldRetry) {
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1);

      await Event.updateOne(
        ownedFilter(),
        {
          $set: {
            status: "pending",
            lastError: errorMessage,
            nextAttemptAt: new Date(
              Date.now() + delay
            )
          },
          $unset: {
            lockedBy: "",
            lockedUntil: ""
          },
          $setOnInsert: {}
        }
      );

      // Record the error in the matching attempt
      await Event.updateOne(
        {
          _id: event._id,
          "attemptHistory.attempt": attempt
        },
        {
          $set: {
            "attemptHistory.$.error": errorMessage
          }
        }
      );

      console.log(
        `Retry scheduled: ${event.eventId}, attempt ${attempt}`
      );

      return;
    }

    // Permanent failure or retries exhausted
    await Event.updateOne(
      ownedFilter(),
      {
        $set: {
          status: "failed",
          lastError: errorMessage,
          "attemptHistory.$[entry].error": errorMessage
        },
        $unset: {
          lockedBy: "",
          lockedUntil: ""
        }
      },
      {
        arrayFilters: [
          { "entry.attempt": attempt }
        ]
      }
    );

    console.log(
      `Event failed: ${event.eventId}, HTTP ${result.statusCode}`
    );

  } catch (error) {
    // Unexpected provider errors must not be treated
    // as a successful verification.
    console.error("Provider processing error:", error);

    // Keep the event processing so its lease expires.
    // A later worker can recover it. Its attempt was
    // already counted, preventing unlimited retries.
  }
};
