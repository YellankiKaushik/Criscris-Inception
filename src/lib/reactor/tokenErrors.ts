export const REACTOR_MODEL_ID = "reactor/lingbot-world-2";

export type ReactorTokenErrorCode =
  | "REACTOR_KEY_MISSING"
  | "REACTOR_AUTH_FAILED"
  | "REACTOR_RATE_LIMITED"
  | "REACTOR_UNAVAILABLE"
  | "REACTOR_TIMEOUT"
  | "REACTOR_NETWORK"
  | "REACTOR_MALFORMED"
  | "REACTOR_TOKEN_FAILED";

export interface ReactorTokenErrorBody {
  error: {
    code: ReactorTokenErrorCode;
    message: string;
  };
}

export const SAFE_TOKEN_MESSAGES: Record<ReactorTokenErrorCode, string> = {
  REACTOR_KEY_MISSING: "World-model authentication is not configured on the server.",
  REACTOR_AUTH_FAILED: "Unable to authenticate with the world-model service.",
  REACTOR_RATE_LIMITED: "The world-model service is temporarily rate-limited.",
  REACTOR_UNAVAILABLE: "The world-model service is temporarily unavailable.",
  REACTOR_TIMEOUT: "Timed out while requesting a world session.",
  REACTOR_NETWORK: "Network failure while requesting a world session.",
  REACTOR_MALFORMED: "Received an invalid session response from the world-model service.",
  REACTOR_TOKEN_FAILED: "Unable to initialize the generated world.",
};

export function tokenErrorResponse(status: number, code: ReactorTokenErrorCode): Response {
  const body: ReactorTokenErrorBody = {
    error: {
      code,
      message: SAFE_TOKEN_MESSAGES[code],
    },
  };
  return Response.json(body, { status });
}
