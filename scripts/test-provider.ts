
import { verifyWithProvider } from "../src/services/fakeProvider";

const runTests = async () => {
  console.log("Testing event-101:");

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await verifyWithProvider(
      "event-101",
      attempt
    );

    console.log(`Attempt ${attempt}:`, result);
  }

  console.log("\nTesting event-102:");
  console.log(await verifyWithProvider("event-102", 1));

  console.log("\nTesting unknown event:");
  console.log(await verifyWithProvider("event-999", 1));
};

runTests();
