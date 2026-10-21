# Submission notes (review before sharing)

This package is integrated from the uploaded project. It is not claimed to be fully tested against a live MongoDB replica set.

- Original 20-request fixture was not supplied; `fixtures/demo.example.json` is only a format example. Place the original scenario in `fixtures/demo.json` before running `npm run demo`.
- Run `npm run typecheck`, `npm run build`, `docker compose up --build -d`, `npm run load`, and record actual outcomes in `QC_REPORT.md`.
- The worker uses a 30-second lease and has no heartbeat. If provider verification or a transaction lasts longer than that, lease expiry can cause duplicate provider calls. Verification is fake and has no external side effects.
- Crash after provider success but before `providerVerified` is stored may repeat verification; MongoDB transaction makes job projection and event acknowledgement atomic.
- If a real MongoDB has duplicate logical jobs, clean them up before building the new unique index.
- MongoDB hostname `mongo` in Compose is not resolvable from a Windows host. Use a local MongoDB replica set for host-side tests, or run test commands in a suitable container/network.
- Review documentation and `AI_USAGE.md` for personal accuracy, actual time spent, and commit SHA.
