import { createHash, randomBytes } from "node:crypto";

type RateRecord = {
  tenMinuteAttempts: number[];
  dailyAttempts: number[];
  lastSeen: number;
};

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const TEN_MINUTES = 10 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const MAX_IP_RECORDS = 10_000;
const PER_IP_TEN_MINUTES = 3;
const PER_IP_DAY = 10;
const GLOBAL_HOUR = 20;
const MAX_CONCURRENT_DELIVERIES = 3;

export class ContactRateLimiter {
  private readonly salt = randomBytes(32);
  private readonly records = new Map<string, RateRecord>();
  private globalAttempts: number[] = [];
  private activeDeliveries = 0;

  private keyFor(address: string) {
    return createHash("sha256").update(this.salt).update(address).digest("hex");
  }

  private prune(now: number) {
    this.globalAttempts = this.globalAttempts.filter((timestamp) => now - timestamp < ONE_HOUR);

    for (const [key, record] of this.records) {
      record.tenMinuteAttempts = record.tenMinuteAttempts.filter(
        (timestamp) => now - timestamp < TEN_MINUTES
      );
      record.dailyAttempts = record.dailyAttempts.filter((timestamp) => now - timestamp < ONE_DAY);

      if (now - record.lastSeen >= ONE_DAY) {
        this.records.delete(key);
      }
    }

    if (this.records.size > MAX_IP_RECORDS) {
      const oldest = [...this.records.entries()]
        .sort((left, right) => left[1].lastSeen - right[1].lastSeen)
        .slice(0, this.records.size - MAX_IP_RECORDS);

      for (const [key] of oldest) this.records.delete(key);
    }
  }

  consume(address: string, now = Date.now()): RateLimitResult {
    this.prune(now);

    if (this.globalAttempts.length >= GLOBAL_HOUR) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((ONE_HOUR - (now - this.globalAttempts[0])) / 1000)
      );
      return { allowed: false, retryAfterSeconds };
    }

    const key = this.keyFor(address);
    const record = this.records.get(key) ?? {
      tenMinuteAttempts: [],
      dailyAttempts: [],
      lastSeen: now
    };

    if (record.tenMinuteAttempts.length >= PER_IP_TEN_MINUTES) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((TEN_MINUTES - (now - record.tenMinuteAttempts[0])) / 1000)
        )
      };
    }

    if (record.dailyAttempts.length >= PER_IP_DAY) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((ONE_DAY - (now - record.dailyAttempts[0])) / 1000)
        )
      };
    }

    record.tenMinuteAttempts.push(now);
    record.dailyAttempts.push(now);
    record.lastSeen = now;
    this.records.set(key, record);
    this.globalAttempts.push(now);

    return { allowed: true };
  }

  acquireDeliverySlot() {
    if (this.activeDeliveries >= MAX_CONCURRENT_DELIVERIES) return false;
    this.activeDeliveries += 1;
    return true;
  }

  releaseDeliverySlot() {
    this.activeDeliveries = Math.max(0, this.activeDeliveries - 1);
  }
}

export const contactRateLimiter = new ContactRateLimiter();
