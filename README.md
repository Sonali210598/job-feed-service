# Reliable Job-Feed Ingestion Service

TypeScript / Express / MongoDB service for durable asynchronous job-event ingestion.

## Requirements
- Node.js 22+ and npm
- MongoDB replica set (single-node `rs0` is sufficient for local transactions)
- Copy `.env.example` to `.env` and set `MONGO_URI`, `PORT`, and `RETRY_BASE_MS`.

## Local setup
```powershell
npm ci
npm run typecheck
npm run dev
```

API: `http://localhost:5000`; Swagger: `http://localhost:5000/api-docs` (adjust port if configured differently).

## Endpoints
- `POST /events`: `202` new durable event, `200` identical replay, `409` conflicting reuse, `400` invalid input.
- `GET /events/:eventId?tenantId=...&sourceId=...`: status, attempts, last error and history.
- `GET /jobs?tenantId=...&sourceId=...&status=active&limit=20&cursor=...`: scoped, deterministic listing. `status` supports `active`, `archived`, `all`.
- `GET /health`: health endpoint; **verify whether implementation checks MongoDB readiness before describing it as dependency readiness**.

Example request:
```powershell
$body = @{tenantId='tenant-a';sourceId='main';eventId='example-001';externalJobId='alpha';version=1;operation='upsert';payload=@{title='Full Stack Developer';company='Example Labs';location='Surat';experienceMin=1;experienceMax=3;applyUrl='https://example.test/jobs/alpha';skills=@('TypeScript','MongoDB')}} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/events' -ContentType 'application/json' -Body $body
```

## Tests
```powershell
npm run typecheck
npm test
```

## Demo
The assignment requires one reproducible demo command that submits the **20 supplied fixture requests in order**, waits for phase 1 to settle, submits delayed phase 2, and checks final outcomes. **TODO before claiming compliance:** add the fixture file and a `demo` script to `package.json`, then document the actual `npm run demo` command and output here. Do not substitute a hand-entered Swagger example for the required fixture demo.

## Docker Compose
**TODO:** provide a working `compose.yaml` and a one-command setup. MongoDB must be a replica set if transactions are used. Test from a clean environment before claiming it works.

## Notes
- Events and jobs are identified by `(tenantId, sourceId, eventId)` and `(tenantId, sourceId, externalJobId)` respectively.
- MongoDB stores accepted work and current job projections.
- Two asynchronous worker loops compete for claims.
- See `DESIGN.md`, `SCALE.md`, `AI_USAGE.md`, and `QC_REPORT.md`.
- **Known limitations:** fill in after final tests; do not delete this section if required checks are missing.

## Docker Compose (one setup command)
Run `docker compose up --build -d` from the repository root. This starts a MongoDB single-node replica set and the API/worker process. Wait for `http://localhost:5000/health`. Stop with `docker compose down` (add `-v` **only** to erase the Docker database). Docker Desktop is required. The container uses `MONGO_URI=mongodb://mongo:27017/job_feed_db?replicaSet=rs0`; for Windows-host scripts connecting to the Docker MongoDB replica set, use the application API rather than connecting with `mongosh` to the internal replica-set hostname.

## Fixture demo (one demo command)
The original recruiter-supplied 20-request fixture must be added to `fixtures/demo.json`. See `fixtures/demo.example.json` for the runner's wrapper format; it is **not** the original fixture and is intentionally insufficient for a passing 20-request demo. Translate the original fixture into `phase1` / `phase2` arrays without changing request order or expected outcomes. Each request has `{ "body": {...}, "expectedStatus": 202 }`. Add `expectedEvents` and `expectedJobs` for final-state assertions. Start the service, then run `npm run demo`. If your GET `/jobs` response envelope differs, update `scripts/demo.ts` where indicated.

## Local load scenario
Run `npm run load` against a running service. It sends 1,000 distinct valid events and 200 exact replays, with 50 jobs receiving version 2 before version 1. Set `LOAD_CONCURRENCY` and `LOAD_TIMEOUT_MS` as needed. The script prints observed HTTP p50/p95, status counts and final-state drain time. It does not supply benchmark results in advance.

## Required package scripts
Merge these into the existing `scripts` object in `package.json` (do not replace other scripts):
```json
"demo": "tsx scripts/demo.ts",
"load": "tsx scripts/load.ts"
```
The runner scripts use Node 22+ built-in `fetch`; `tsx` must already be installed as a dev dependency. For Docker setup, use `docker compose up --build -d`.

## Known verification gaps
Do not claim fixture-demo, Docker, load, deterministic crash-injection or independent QC passes until actually executed and recorded in `QC_REPORT.md`. The provided helper scripts and Compose file are templates requiring a run against the final repository. The demo runner is intentionally strict about missing expected outcomes.
