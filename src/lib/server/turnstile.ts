const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 8_000;
const MAX_TOKEN_LENGTH = 2_048;
const MAX_CHALLENGE_AGE_MS = 5 * 60 * 1000 + 30_000;

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  challenge_ts?: string;
  "error-codes"?: string[];
};

export type TurnstileResult =
  | { ok: true }
  | { ok: false; status: number; error: string; codes: string[] };

export const verifyTurnstile = async ({
  fetch,
  token,
  secret,
  remoteIp,
  requestId,
  expectedHostname = "contact.nickesselman.nl",
  expectedAction = "contact",
  now = Date.now()
}: {
  fetch: typeof globalThis.fetch;
  token: string;
  secret: string;
  remoteIp?: string;
  requestId: string;
  expectedHostname?: string;
  expectedAction?: string;
  now?: number;
}): Promise<TurnstileResult> => {
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: "Please complete the security check.",
      codes: ["missing-or-invalid-token"]
    };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: requestId
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: "The security check is unavailable. Please try again.",
        codes: [`upstream-${response.status}`]
      };
    }

    let result: TurnstileResponse;
    try {
      result = (await response.json()) as TurnstileResponse;
    } catch {
      return {
        ok: false,
        status: 502,
        error: "The security check is unavailable. Please try again.",
        codes: ["invalid-response"]
      };
    }

    const challengeTime = result.challenge_ts ? Date.parse(result.challenge_ts) : Number.NaN;
    const challengeIsFresh =
      Number.isFinite(challengeTime) &&
      challengeTime <= now + 30_000 &&
      now - challengeTime <= MAX_CHALLENGE_AGE_MS;

    if (
      !result.success ||
      result.hostname !== expectedHostname ||
      result.action !== expectedAction ||
      !challengeIsFresh
    ) {
      return {
        ok: false,
        status: 400,
        error: "The security check was not accepted. Please try again.",
        codes: result["error-codes"] ?? ["verification-mismatch"]
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 502,
      error: "The security check is unavailable. Please try again.",
      codes: ["request-failed"]
    };
  } finally {
    clearTimeout(timeout);
  }
};
