import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Event from "../models/Event";
import { verifyWithProvider } from "../services/fakeProvider";
import { applyJobProjection } from "../services/jobProjection";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 30000;
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS ?? 2000);
if (!Number.isFinite(RETRY_BASE_MS) || RETRY_BASE_MS <= 0) throw new Error("Invalid RETRY_BASE_MS");

export async function claimNextEvent() {
  const now = new Date();
  return Event.findOneAndUpdate({ $or: [
    { status: "pending", nextAttemptAt: { $lte: now } },
    { status: "processing", lockedUntil: { $lte: now } }
  ] }, { $set: { status: "processing", lockedBy: randomUUID(), lockedUntil: new Date(now.getTime() + LEASE_MS) } },
  { new: true, sort: { nextAttemptAt: 1, _id: 1 } });
}

type ClaimedEvent = NonNullable<Awaited<ReturnType<typeof claimNextEvent>>>;
export async function processEvent(event: ClaimedEvent): Promise<void> {
  const owned = () => ({ _id: event._id, status: "processing", lockedBy: event.lockedBy, lockedUntil: { $gt: new Date() } });
  const fail = async (message: string, attempt: number, retry: boolean) => {
    const update: Record<string, unknown> = { status: retry ? "pending" : "failed", lastError: message };
    if (retry) update.nextAttemptAt = new Date(Date.now() + RETRY_BASE_MS * 2 ** (attempt - 1));
    await Event.updateOne(owned(), { $set: update, $unset: { lockedBy: "", lockedUntil: "" } });
    await Event.updateOne({ _id: event._id, "attemptHistory.attempt": attempt }, { $set: { "attemptHistory.$.error": message } });
  };
  try {
    if (!event.providerVerified) {
      if (event.attempts >= MAX_ATTEMPTS) {
        await Event.updateOne(owned(), { $set: { status: "failed", lastError: event.lastError ?? "Attempt limit reached after worker interruption" }, $unset: { lockedBy: "", lockedUntil: "" } });
        return;
      }
      const attempt = event.attempts + 1;
      const recorded = await Event.updateOne(owned(), { $set: { attempts: attempt }, $push: { attemptHistory: { attempt, createdAt: new Date() } } });
      if (recorded.modifiedCount !== 1) return;
      let result;
      try { result = await verifyWithProvider(event.eventId, attempt); }
      catch (error) { await fail(String(error), attempt, attempt < MAX_ATTEMPTS); return; }
      if (!result.success) {
        await fail(result.message, attempt, (result.statusCode === 429 || result.statusCode === 503) && attempt < MAX_ATTEMPTS);
        return;
      }
      const verified = await Event.updateOne(owned(), { $set: { providerVerified: true } });
      if (verified.modifiedCount !== 1) return;
    }
    // A single transaction makes projection and acknowledgement atomic.
    // Retry the entire transaction on transient write conflicts.
    for (let retry = 0; retry < 5; retry++) {
      try {
        await mongoose.connection.transaction(async session => {
          const acknowledged = await Event.updateOne(owned(), { $set: { status: "completed" }, $unset: { lockedBy: "", lockedUntil: "", lastError: "" } }, { session });
          if (acknowledged.modifiedCount !== 1) throw new Error("Lease ownership lost");
          await applyJobProjection({ tenantId: event.tenantId, sourceId: event.sourceId, externalJobId: event.externalJobId, version: event.version, operation: event.operation, payload: event.payload }, session);
        });
        return;
      } catch (error: unknown) {
        const e = error as { code?: number; hasErrorLabel?: (label: string) => boolean; message?: string };
        if (e.message === "Lease ownership lost") return;
        if (retry === 4 || !(e.code === 11000 || e.code === 112 || e.hasErrorLabel?.("TransientTransactionError"))) throw error;
        await new Promise(resolve => setTimeout(resolve, 30 * (retry + 1)));
      }
    }
  } catch (error) {
    // Keep verified work recoverable; lease expiry allows a new claim.
    console.error("Worker error (will recover after lease):", error);
  }
}
