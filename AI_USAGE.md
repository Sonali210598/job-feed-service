# AI Usage Disclosure

| Field | Details |
|---|---|
| Tool/model | ChatGPT (OpenAI; GPT-6 as identified in this session) |
| Purpose | Helped design and implement TypeScript/MongoDB event validation, idempotency, worker claims/retries, versioned job projection, transaction recovery, and integration-test cases. |
| Prompt summary | Requested simple, one-file-at-a-time code for a reliable job-feed ingestion assignment, including provider failures, concurrent workers and crash recovery. |
| Artifacts | `src/controllers/*`, `src/services/*`, `src/workers/*`, `tests/*`, and documentation — **edit this list to exactly match your repository**. |
| Human decisions/revisions | Reviewed TypeScript compatibility, local MongoDB replica-set setup, provider fixture loading, archive tombstone behavior and test failures. **Add concrete fixes you personally made; do not invent reviews.** |
| Verification | User reported passing Step 10.2 provider tests, Step 10.3 projection tests, Step 10.4 worker smoke tests and Step 11.1–11.2 integration tests. **Replace with final recorded commands/results from your terminal.** |
| Commit SHA | **TODO: insert actual Git commit SHA** |
| Known limits | See `DESIGN.md` and `QC_REPORT.md`; AI-generated suggestions are not independent proof of correctness. |

No private chat transcript is included. The candidate is responsible for all final code and claims.

## Additional AI-assisted deliverables (2026-10-21)
ChatGPT (OpenAI, GPT-6) generated draft `Dockerfile`, `compose.yaml`, `scripts/demo.ts`, `scripts/load.ts`, fixture wrapper example and submission Markdown documentation from the candidate's assignment PDF and previously described code structure. Prompt summary: "Create the missing required submission files from the assignment PDF, including Docker, demo and AI usage disclosure." These are **draft artifacts** until the candidate copies, reviews, runs and verifies them against the actual repository. The candidate should record concrete modifications and observed command outputs in this document and `QC_REPORT.md` after final testing.
