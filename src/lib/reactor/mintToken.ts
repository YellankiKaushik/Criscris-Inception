import { REACTOR_MODEL_ID, tokenErrorResponse } from "./tokenErrors";

const REACTOR_TOKEN_URL = "https://api.reactor.inc/tokens";
const TOKEN_TIMEOUT_MS = 12_000;

function readApiKey(): string | undefined {
  const key = process.env["REACTOR_API_KEY"];
  if (typeof key !== "string") return undefined;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function mintReactorSessionToken(): Promise<Response> {
  const apiKey = readApiKey();
  if (!apiKey) {
    return tokenErrorResponse(500, "REACTOR_KEY_MISSING");
  }

  let response: Response;
  try {
    response = await fetch(REACTOR_TOKEN_URL, {
      method: "POST",
      headers: {
        "Reactor-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        authorization_details: [
          {
            type: "session",
            resources: {
              models: {
                match: [REACTOR_MODEL_ID],
              },
            },
            constraints: {
              max_sessions: 4,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return tokenErrorResponse(504, "REACTOR_TIMEOUT");
    }
    return tokenErrorResponse(502, "REACTOR_NETWORK");
  }

  const status = response.status;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (status === 401 || status === 403) {
    return tokenErrorResponse(502, "REACTOR_AUTH_FAILED");
  }
  if (status === 429) {
    return tokenErrorResponse(429, "REACTOR_RATE_LIMITED");
  }
  if (status >= 500) {
    return tokenErrorResponse(502, "REACTOR_UNAVAILABLE");
  }
  if (!response.ok) {
    return tokenErrorResponse(502, "REACTOR_TOKEN_FAILED");
  }

  if (!isRecord(payload) || typeof payload["jwt"] !== "string" || payload["jwt"].length < 16) {
    return tokenErrorResponse(502, "REACTOR_MALFORMED");
  }

  return Response.json({ jwt: payload["jwt"] });
}
