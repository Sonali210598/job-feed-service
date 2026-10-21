
import fs from "node:fs";
import path from "node:path";

type ProviderStatus = 200 | 429 | 503 | 422;

interface ProviderResult {
  success: boolean;
  statusCode: ProviderStatus;
  message: string;
}

type ProviderPlan = Record<string, ProviderStatus[]>;

// Load the provider plan from the fixtures folder
const planPath = path.join(
  process.cwd(),
  "fixtures",
  "provider-plan.json"
);

const providerPlan = JSON.parse(
  fs.readFileSync(planPath, "utf-8")
) as ProviderPlan;

export const verifyWithProvider = async (
  eventId: string,
  attempt: number
): Promise<ProviderResult> => {
  // Find configured responses for this event
  const responses = providerPlan[eventId];

  // Default to success if event is not configured
  const statusCode: ProviderStatus =
    responses?.[attempt - 1] ?? 200;

  if (statusCode === 200) {
    return {
      success: true,
      statusCode: 200,
      message: "Provider verification successful"
    };
  }

  return {
    success: false,
    statusCode,
    message: `Provider returned HTTP ${statusCode}`
  };
};
