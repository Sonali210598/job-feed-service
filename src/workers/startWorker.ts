import { claimNextEvent, processEvent } from "./eventWorker";
let running = false;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export function startWorkers(count = 2) {
  if (running) return;
  running = true;
  for (let i = 0; i < count; i++) void (async () => {
    while (running) {
      try { const event = await claimNextEvent(); if (event) await processEvent(event); else await pause(500); }
      catch (error) { console.error(`Worker ${i + 1}:`, error); await pause(1000); }
    }
  })();
}
export function stopWorkers() { running = false; }
