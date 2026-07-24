import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../src/lib/server/turnstile";

const now = Date.parse("2026-07-24T12:00:00.000Z");

const verify = (response: object, overrides: Record<string, unknown> = {}) =>
  verifyTurnstile({
    fetch: vi.fn(async () => Response.json(response)) as unknown as typeof fetch,
    token: "valid-token",
    secret: "secret",
    remoteIp: "192.0.2.1",
    requestId: "request-id",
    now,
    ...overrides
  });

describe("verifyTurnstile", () => {
  it("accepts a fresh token for the expected hostname and action", async () => {
    const result = await verify({
      success: true,
      hostname: "contact.nickesselman.nl",
      action: "contact",
      challenge_ts: new Date(now - 30_000).toISOString()
    });

    expect(result).toEqual({ ok: true });
  });

  it("rejects the wrong hostname or action", async () => {
    const wrongHost = await verify({
      success: true,
      hostname: "example.com",
      action: "contact",
      challenge_ts: new Date(now).toISOString()
    });
    const wrongAction = await verify({
      success: true,
      hostname: "contact.nickesselman.nl",
      action: "login",
      challenge_ts: new Date(now).toISOString()
    });

    expect(wrongHost.ok).toBe(false);
    expect(wrongAction.ok).toBe(false);
  });

  it("rejects stale, missing, and oversized tokens", async () => {
    const stale = await verify({
      success: true,
      hostname: "contact.nickesselman.nl",
      action: "contact",
      challenge_ts: new Date(now - 10 * 60_000).toISOString()
    });
    const missing = await verify({}, { token: "" });
    const oversized = await verify({}, { token: "x".repeat(2049) });

    expect(stale.ok).toBe(false);
    expect(missing.ok).toBe(false);
    expect(oversized.ok).toBe(false);
  });

  it("fails closed on upstream and JSON errors", async () => {
    const network = await verifyTurnstile({
      fetch: vi.fn(async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
      token: "token",
      secret: "secret",
      requestId: "request-id",
      now
    });
    const invalidJson = await verifyTurnstile({
      fetch: vi.fn(async () => new Response("not json")) as unknown as typeof fetch,
      token: "token",
      secret: "secret",
      requestId: "request-id",
      now
    });

    expect(network).toMatchObject({ ok: false, status: 502 });
    expect(invalidJson).toMatchObject({ ok: false, status: 502 });
  });
});
