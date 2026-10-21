/** Reproducible synthetic load. Requires running API + worker.
 * 1000 distinct valid events, 200 exact replays, 50 out-of-order jobs.
 */
import "dotenv/config";
const base = process.env.API_URL ?? "http://localhost:5000";
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);
const tenantId = process.env.LOAD_TENANT ?? `load-${Date.now()}`;
const timeoutMs = Number(process.env.LOAD_TIMEOUT_MS ?? 300000);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
type EventBody = {
  tenantId: string; sourceId: string; eventId: string; externalJobId: string;
  version: number; operation: "upsert"; payload: {
    title: string; company: string; location: string; experienceMin: number;
    experienceMax: number; applyUrl: string; skills: string[];
  };
};
const events: EventBody[] = [];
for (let i = 0; i < 950; i++) events.push(makeEvent(i, `job-${i}`, 1));
// Versions 2 arrive before versions 1 for 50 jobs. 1000 distinct event IDs total.
for (let i = 0; i < 50; i++) events.push(makeEvent(950 + i, `job-${i}`, 2));
function makeEvent(i: number, externalJobId: string, version: number): EventBody {
  return { tenantId, sourceId: "load", eventId: `event-${i}`, externalJobId,
    version, operation: "upsert", payload: { title: `Job ${i}`, company: "Load Test",
      location: "Surat", experienceMin: 1, experienceMax: 3,
      applyUrl: `https://example.test/jobs/${externalJobId}`, skills: ["typescript"] } };
}
// Force high versions to arrive before low versions on those 50 jobs.
const first = events.slice(950); const rest = events.slice(0, 950);
const requests = [...first, ...rest, ...events.slice(0, 200)];
const times: number[] = []; const counts: Record<string, number> = {};
async function send(body: EventBody) {
  const start = performance.now();
  const res = await fetch(`${base}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  times.push(performance.now() - start);
  counts[res.status] = (counts[res.status] ?? 0) + 1;
  if (![200, 202].includes(res.status)) console.error(`HTTP ${res.status}: ${await res.text()}`);
}
async function batch(items: EventBody[]) {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) { const item = items[next++]; await send(item); }
  }));
}
function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.min(sorted.length-1, Math.ceil(sorted.length*p)-1)].toFixed(1);
}
async function main() {
  const started = Date.now();
  // Complete high-version batch before low-version batch to ensure out-of-order delivery.
  await batch(first);
  await batch([...rest, ...events.slice(0, 200)]);
  console.log({ tenantId, concurrency, requests: requests.length, counts,
    p50Ms: percentile(times, .5), p95Ms: percentile(times, .95) });
  if (counts[202] !== 1000 || counts[200] !== 200) throw new Error("Unexpected accepted/replay counts");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const qs = new URLSearchParams({ tenantId, sourceId: "load", status: "all", limit: "100" });
    let cursor: string | undefined; let seen = 0; let versionFailures = 0;
    do {
      if (cursor) qs.set("cursor", cursor); else qs.delete("cursor");
      const res = await fetch(`${base}/jobs?${qs}`);
      if (!res.ok) throw new Error(`GET /jobs: HTTP ${res.status}`);
      const body: any = await res.json();
      const jobs: any[] = body.jobs ?? body.data ?? [];
      seen += jobs.length;
      versionFailures += jobs.filter(j => /^job-([0-9]+)$/.test(j.externalJobId) && Number(j.externalJobId.slice(4)) < 50 && j.version !== 2).length;
      cursor = body.nextCursor ?? undefined;
    } while (cursor);
    if (seen === 950 && versionFailures === 0) {
      console.log(`Drain/final projection checks PASS: jobs=${seen}, drainMs=${Date.now()-started}`);
      return;
    }
    await sleep(500);
  }
  throw new Error("Timed out waiting for 950 projections at correct versions");
}
main().catch(e => { console.error(e); process.exitCode = 1; });
