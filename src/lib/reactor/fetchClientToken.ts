import { SAFE_TOKEN_MESSAGES, type ReactorTokenErrorCode } from "./tokenErrors";

export class ReactorClientError extends Error {
  readonly code: ReactorTokenErrorCode;
  constructor(code: ReactorTokenErrorCode, message: string) {
    super(message);
    this.name = "ReactorClientError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function fetchReactorJwt(): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/reactor-token", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new ReactorClientError("REACTOR_NETWORK", SAFE_TOKEN_MESSAGES.REACTOR_NETWORK);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new ReactorClientError(
        "REACTOR_TOKEN_FAILED",
        SAFE_TOKEN_MESSAGES.REACTOR_TOKEN_FAILED,
      );
    }
    throw new ReactorClientError("REACTOR_MALFORMED", SAFE_TOKEN_MESSAGES.REACTOR_MALFORMED);
  }

  if (!response.ok) {
    const code =
      isRecord(payload) &&
      isRecord(payload["error"]) &&
      typeof payload["error"]["code"] === "string"
        ? (payload["error"]["code"] as ReactorTokenErrorCode)
        : "REACTOR_TOKEN_FAILED";
    const message = SAFE_TOKEN_MESSAGES[code] ?? SAFE_TOKEN_MESSAGES.REACTOR_TOKEN_FAILED;
    throw new ReactorClientError(code, message);
  }

  if (!isRecord(payload) || typeof payload["jwt"] !== "string" || payload["jwt"].length < 16) {
    throw new ReactorClientError("REACTOR_MALFORMED", SAFE_TOKEN_MESSAGES.REACTOR_MALFORMED);
  }

  return payload["jwt"];
}
