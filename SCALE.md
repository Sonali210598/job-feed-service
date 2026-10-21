# Scaling Design (Assumptions, Not Measured Benchmarks)

## Workload
- 100,000 events/day = **1.16 events/s average**.
- 10,000,000 events/day = **115.74 events/s average**.
- Burst = **5,000 events/s**, with a five-minute processing target at the stated capacity.
- Raw payload averages **1 KB**, retained **7 days**; approximately **70 GB raw payload** at 10M/day before document overhead, indexes and replication. Three replicas imply at least **210 GB** raw payload copies before overhead.
- Approximately **1 million** current job documents.

## Illustrative capacity model
Assume one worker slot averages **50 ms** per verification + projection under healthy database/provider conditions: **20 events/s per slot** before retries. At 10M/day, 8 slots nominally provide 160 events/s; utilization at the average is ~72%. These are planning assumptions, **not local measurements**.

A 5,000/s burst sustained for **60 seconds** brings 300,000 events. With 160/s capacity, 9,600 process during the burst and backlog grows by approximately **290,400**. After the burst, if the normal 115.74/s arrival rate resumes, net drain capacity is 44.26/s, requiring **~109 minutes** to clear: this **fails the five-minute target**. Even with zero post-burst arrivals, drain time is ~30.3 minutes. The 160/s design can sustain the 5,000/s burst without growing backlog for **0 seconds**; it can absorb a short burst durably but not meet the latency objective.

To clear the 60-second burst backlog within 5 minutes while normal traffic continues requires about `115.74 + 290400/300 = 1083.74 events/s` of post-burst processing capacity. At 20 events/s per slot, **at least 55 slots** are needed in this simplified model. During the burst, capacity below 5,000/s still accumulates backlog. Size database writes and provider limits accordingly, and validate by load testing.

## Data/index strategy
Unique compound indexes for event and job identity; claim index for `(status, nextAttemptAt, lockedUntil)` and tenant-scoped listing indexes. Avoid unbounded history arrays; consider a separate attempts collection if histories grow. Add a TTL index on a dedicated `expiresAt` for raw-event retention **only after confirming no pending/recoverable work will be deleted**. TTL removal is approximate, not immediate.

Hot keys and contention: many versions for one job serialize on the same projection document. Consider partitioning by tenant/source/job hash. MongoDB sharding and globally enforced unique indexes require careful shard-key alignment; a unique index that omits the shard-key prefix may not be globally enforceable.

## Backpressure and fairness
Cap request body size, DB connection pool, worker concurrency and in-flight transactions. Reject/admit requests when database saturation or oldest queue age crosses thresholds; return an appropriate retryable response. Use per-tenant quotas or fair claim scheduling to prevent noisy tenants from starving others. Add jitter to exponential retries and limit concurrent retries to prevent storms.

## Metrics and alerts
Track acceptance rate and p50/p95 latency, oldest pending event age, pending count, processing-to-completion lag, retry rate, terminal failures, lease expiries, provider latency, transaction conflicts, MongoDB CPU/disk utilization and replication lag. Alert when oldest pending age approaches 5 minutes, terminal failure rate spikes or database saturation persists.

## When to change architecture
If MongoDB claim polling, contention or cross-tenant fairness becomes a limiting factor, separate API and worker deployments, consider change streams and then a dedicated durable broker (Kafka/SQS/etc.) with idempotent consumers. Keep MongoDB as the source of truth for job projections.

## Required local benchmark
**NOT YET RECORDED.** The assignment requires >=1,000 distinct valid events, 200 exact replays, and >=50 out-of-order jobs, using a separate tenant. Record actual machine, Node/Mongo versions, concurrency, HTTP accepted/replay/error counts, p50/p95 latency, final-state assertions and drain time. Never present the assumptions above as measured results.
