# Design

## Invariants
1. A valid event is persisted before returning `202`.
2. Same event identity and equivalent parsed JSON returns `200`; conflicting reuse returns `409`. Object-key order is ignored; array order is not.
3. Job identity includes tenant, source and external job ID; event identity includes tenant, source and event ID.
4. The highest **successfully applied** version wins. Archive writes a versioned tombstone; lower/equal versions never restore it.
5. A failed provider verification must not modify the job projection.
6. Reads require tenant scope. Production must authenticate callers and authorize tenant membership; a caller-supplied tenant ID is only trusted for this demo.

## Data model and indexes
`events`: raw input, normalized fields, state (`pending`, `processing`, `completed`, `failed`), attempt history, retry time, lease token and expiry, and persisted provider-verification marker. Unique index `(tenantId, sourceId, eventId)`; worker-claim index covering status/retry/lease fields.

`jobs`: latest version, active/archived status and normalized payload. Unique index `(tenantId, sourceId, externalJobId)`; tenant/source/status/pagination indexes. Check actual model index definitions before submission.

## Processing lifecycle
`POST /events` validates and writes a pending event. Two workers atomically claim eligible work with a token and lease. Non-stale work is verified against the fake provider. HTTP `429` and `503` schedule increasing backoff (up to three normal provider attempts); `422` is terminal. Verified events project a version-conditional job update. Projection and completion acknowledgement run in one MongoDB transaction. An expired lease can be reclaimed; persisted provider success avoids unnecessary re-verification after a crash.

## Atomicity and failure boundaries
- **Acceptance failure:** do not return `202` if MongoDB persistence fails.
- **Crash after acceptance:** pending MongoDB work survives process restart.
- **Crash during provider call:** an attempt may be consumed; success not persisted before the crash cannot be inferred. External calls are at-least-once, not exactly-once.
- **Crash after persisting verification but before projection:** recovery can complete without another provider call.
- **Crash between projection and acknowledgement:** transaction commits both or neither. Retrying an already applied version is a no-op.
- **Concurrent versions:** conditional MongoDB version updates prevent an older event from overwriting a newer applied version. Duplicate-key/write conflicts require retry of the full database transaction.
- **Lease expiry:** a stale worker must not acknowledge work after losing its token. Verify transaction ownership and transaction retry behavior in real MongoDB tests.

## Choices and rejected alternatives
1. **MongoDB-backed work queue instead of Redis/Kafka:** simpler deployment and durable acceptance with one datastore, at the cost of polling and contention at scale.
2. **Versioned job projection instead of deleting archived jobs:** prevents delayed stale upserts from reactivating jobs, at the cost of retaining tombstones.
3. **In-process two-worker loops instead of separate worker services:** easier local demo, but API and workers share CPU and lifecycle; independent worker deployment is a future improvement.

## First likely bottleneck
Repeated polling and writes against the event-claim index, followed by provider/transaction throughput. At larger scale, measure claim latency, oldest pending age, MongoDB write latency and retries before changing architecture.

## Deliberate tradeoff
The local implementation prioritizes correctness and explainability over throughput and fairness. Worker polling and fixed lease timing are simple but need tuning/renewal and load evidence before production use.

## Open decisions and limitations
- Same job version with conflicting content is outside the fixture contract; in production, detect/log or reject semantic conflicts using a stable content hash.
- Cursor pagination provides deterministic `_id` ordering, but concurrent inserts/updates can change which records match between pages; it is not a snapshot.
- The fake provider has no external side effects. Real providers would need idempotency keys and reconciliation.
- **Verify in code/tests:** stale-event provider bypass, lease renewal or bounded processing time, crash injection, retry classification and uncertain transaction commit outcomes. Do not claim these are proven unless tested.
