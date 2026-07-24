import { describe, expect, it } from "vitest";
import { ContactRateLimiter } from "../src/lib/server/contactRateLimit";

describe("ContactRateLimiter", () => {
  it("allows three attempts then limits the same address", () => {
    const limiter = new ContactRateLimiter();
    const start = 1_000_000;

    expect(limiter.consume("192.0.2.1", start).allowed).toBe(true);
    expect(limiter.consume("192.0.2.1", start + 1).allowed).toBe(true);
    expect(limiter.consume("192.0.2.1", start + 2).allowed).toBe(true);

    const blocked = limiter.consume("192.0.2.1", start + 3);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("expires the ten-minute window", () => {
    const limiter = new ContactRateLimiter();
    const start = 1_000_000;

    limiter.consume("192.0.2.1", start);
    limiter.consume("192.0.2.1", start + 1);
    limiter.consume("192.0.2.1", start + 2);

    expect(limiter.consume("192.0.2.1", start + 600_001).allowed).toBe(true);
  });

  it("limits concurrent delivery slots", () => {
    const limiter = new ContactRateLimiter();
    expect(limiter.acquireDeliverySlot()).toBe(true);
    expect(limiter.acquireDeliverySlot()).toBe(true);
    expect(limiter.acquireDeliverySlot()).toBe(true);
    expect(limiter.acquireDeliverySlot()).toBe(false);
    limiter.releaseDeliverySlot();
    expect(limiter.acquireDeliverySlot()).toBe(true);
  });
});
