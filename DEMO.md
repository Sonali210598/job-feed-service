# Demo Guide

## Before demo
1. Start a MongoDB replica set and configure `.env`.
2. Run `npm ci`, `npm run typecheck`, `npm test`, then `npm run dev`.
3. Open `http://localhost:5000/api-docs`.

## Manual demonstration
1. Submit valid `POST /events` -> `202`.
2. Replay identical event -> `200`; change content under same identity -> `409`.
3. Query `GET /events/:eventId` and show attempts/status.
4. Query `GET /jobs` and show active, archived, all and cursor behavior.
5. Show configured fake-provider 429/503 retries and 422 terminal failure.
6. Show version ordering and archive-before-upsert tombstone using real MongoDB tests.
7. Explain two-worker claim tokens, lease recovery and transaction atomicity.

## Mandatory automated fixture demo
**TODO:** The assignment requires a single demo command that executes the supplied 20 requests in fixture order, pauses for phase-1 settlement, then submits delayed phase 2 and validates final states. Add `scripts/demo.ts` and the fixture data if absent; record actual command and results here.

## Walkthrough talking points (25 minutes)
- 5 min: API and example request
- 7 min: data model, indexes and version guard
- 5 min: provider failures, two workers and crash/recovery boundaries
- 4 min: integration tests and observed load measurements (or honestly state missing)
- 4 min: AI disclosure, QC evidence, tradeoffs and follow-up questions

## Added runnable commands
From the repository root, after copying these files and merging npm scripts:

```powershell
docker compose up --build -d
npm run demo
npm run load
```

**Fixture prerequisite:** Copy the actual recruiter-supplied 20-request scenario into `fixtures/demo.json` using the wrapper documented in README. `fixtures/demo.example.json` is a format example, not the actual fixture. Never claim a passing demo without it.
