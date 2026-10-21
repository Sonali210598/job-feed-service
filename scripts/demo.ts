/** Fixture runner. Requires fixtures/demo.json in the documented shape.
 * The original assignment's 20-request fixture is NOT bundled here; copy it
 * from the recruiter and adapt its wrapper if the shape differs.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

interface DemoRequest {
  body: Record<string, unknown>;
  expectedStatus: number;
}
interface EventCheck {
  tenantId: string;
  sourceId: string;
  eventId: string;
  status: string;
  attempts?: number;
}
interface JobCheck {
  tenantId: string;
  sourceId: string;
  externalJobId: string;
  version: number;
  status: "active" | "archived";
}
interface Fixture {
  phase1: DemoRequest[];
  phase2: DemoRequest[];
  expectedEvents?: EventCheck[];
  expectedJobs?: JobCheck[];
}
const base = process.env.API_URL ?? "http://localhost:5000";
const fixturePath = process.env.DEMO_FIXTURE ?? "fixtures/demo.json";
const timeoutMs = Number(process.env.DEMO_TIMEOUT_MS ?? 120000);
const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function getJson(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: await res.json() };
}
async function submit(items: DemoRequest[], label: string) {
  for (const [index, item] of items.entries()) {
    const res = await fetch(`${base}/events`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(item.body)
    });
    if (res.status !== item.expectedStatus) {
      throw new Error(`${label} request ${index + 1}: expected HTTP ${item.expectedStatus}, got ${res.status}: ${await res.text()}`);
    }
    console.log(`${label} ${index + 1}/${items.length}: HTTP ${res.status}`);
  }
}
async function waitForEvents(events: EventCheck[], label: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let settled = true;
    for (const e of events) {
      const qs = new URLSearchParams({ tenantId: e.tenantId, sourceId: e.sourceId });
      const res = await getJson(`/events/${encodeURIComponent(e.eventId)}?${qs}`);
      if (res.status !== 200 || res.body.status !== e.status) { settled = false; break; }
      if (e.attempts !== undefined && res.body.attempts !== e.attempts) {
        throw new Error(`${label}: ${e.eventId} expected attempts ${e.attempts}, got ${res.body.attempts}`);
      }
    }
    if (settled) { console.log(`${label}: expected events settled`); return; }
    await pause(250);
  }
  throw new Error(`${label}: timed out after ${timeoutMs}ms`);
}
async function checkJobs(jobs: JobCheck[]) {
  for (const expected of jobs) {
    const qs = new URLSearchParams({ tenantId: expected.tenantId, sourceId: expected.sourceId, status: "all", limit: "100" });
    let cursor: string | undefined;
    let found: any;
    do {
      if (cursor) qs.set("cursor", cursor); else qs.delete("cursor");
      const res = await getJson(`/jobs?${qs}`);
      if (res.status !== 200) throw new Error(`GET /jobs returned ${res.status}`);
      // Adapt these two fields if your documented GET /jobs envelope differs.
      const rows = res.body.jobs ?? res.body.data ?? [];
      found = rows.find((j: any) => j.externalJobId === expected.externalJobId);
      cursor = res.body.nextCursor ?? undefined;
    } while (!found && cursor);
    if (!found || found.version !== expected.version || found.status !== expected.status) {
      throw new Error(`Job check failed: ${JSON.stringify(expected)}; actual=${JSON.stringify(found)}`);
    }
  }
  console.log(`Validated ${jobs.length} final jobs`);
}
async function main() {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;
  if (!Array.isArray(fixture.phase1) || !Array.isArray(fixture.phase2)) {
    throw new Error("Fixture must contain phase1 and phase2 arrays; see fixtures/demo.example.json");
  }
  if (fixture.phase1.length + fixture.phase2.length !== 20) {
    throw new Error("Assignment requires exactly 20 requests across both phases");
  }
  if (!fixture.expectedEvents?.length || !fixture.expectedJobs?.length) {
    throw new Error("Fixture must include expectedEvents and expectedJobs for outcome verification");
  }
  await submit(fixture.phase1, "Phase 1");
  // Settle phase 1 using its event IDs, without waiting for phase 2 events.
  const phase1Ids = new Set(fixture.phase1.map(x => {
    const b = x.body; return `${b.tenantId}|${b.sourceId}|${b.eventId}`;
  }));
  await waitForEvents(fixture.expectedEvents.filter(e => phase1Ids.has(`${e.tenantId}|${e.sourceId}|${e.eventId}`)), "Phase 1");
  await submit(fixture.phase2, "Phase 2");
  await waitForEvents(fixture.expectedEvents, "Final");
  await checkJobs(fixture.expectedJobs);
  console.log("DEMO PASS");
}
main().catch(error => { console.error("DEMO FAIL:", error); process.exitCode = 1; });
