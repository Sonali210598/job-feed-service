
import { validateEvent } from "../src/utils/validateEvent";

const validEvent = {
  tenantId: "tenant-a",
  sourceId: "main",
  eventId: "event-101",
  externalJobId: "alpha",
  version: 1,
  operation: "upsert",
  payload: {
    title: " Full Stack Developer ",
    company: "Example Labs",
    location: "Surat",
    experienceMin: 1,
    experienceMax: 3,
    applyUrl: "https://example.test/jobs/alpha",
    skills: [" TypeScript ", "MongoDB", "typescript"]
  }
};

console.log("Test 1: Valid upsert");
console.log(validateEvent(validEvent));

console.log("\nTest 2: Invalid identifier");
console.log(
  validateEvent({
    ...validEvent,
    eventId: " event-101 "
  })
);

console.log("\nTest 3: Invalid version");
console.log(
  validateEvent({
    ...validEvent,
    version: -1
  })
);

console.log("\nTest 4: Valid archive");
console.log(
  validateEvent({
    tenantId: "tenant-a",
    sourceId: "main",
    eventId: "event-102",
    externalJobId: "alpha",
    version: 2,
    operation: "archive"
  })
);

console.log("\nTest 5: Invalid HTTPS URL");
console.log(
  validateEvent({
    ...validEvent,
    payload: {
      ...validEvent.payload,
      applyUrl: "http://example.com"
    }
  })
);
