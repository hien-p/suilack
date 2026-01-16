import { EnokiClient } from "@mysten/enoki";

// Enoki client for sponsored transactions
// Uses private API key - must be kept on server side only
const ENOKI_API_KEY = process.env.ENOKI_API_KEY || process.env.ENOKI_SECRET_KEY;

if (!ENOKI_API_KEY) {
  console.warn("[EnokiClient] No ENOKI_API_KEY set - sponsored transactions will not work");
}

export const enokiClient = ENOKI_API_KEY
  ? new EnokiClient({
      apiKey: ENOKI_API_KEY,
    })
  : null;

export function getEnokiClient(): EnokiClient {
  if (!enokiClient) {
    throw new Error("Enoki client not configured - set ENOKI_API_KEY environment variable");
  }
  return enokiClient;
}
