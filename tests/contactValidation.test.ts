import { describe, expect, it } from "vitest";
import { validateContactForm } from "../src/lib/contactValidation";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const base = {
  name: "Nick",
  message: "Hello",
  contactMethod: "none",
  source: "",
  subject: ""
};

describe("validateContactForm", () => {
  it("accepts a no-reply submission", () => {
    const result = validateContactForm(form(base));
    expect(result).toEqual({
      ok: true,
      submission: {
        name: "Nick",
        message: "Hello",
        method: "none",
        detail: null,
        source: null,
        honeypot: ""
      }
    });
  });

  it("normalizes phone numbers and allowlisted sources", () => {
    const result = validateContactForm(
      form({
        ...base,
        contactMethod: "whatsapp",
        contactDetail: "00 31 (6) 12-34-56-78",
        source: "portfolio"
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.submission.detail).toBe("+31612345678");
      expect(result.submission.source).toBe("portfolio");
    }
  });

  it("normalizes Instagram handles", () => {
    const result = validateContactForm(
      form({ ...base, contactMethod: "instagram", contactDetail: "@nick.esselman" })
    );
    expect(result.ok && result.submission.detail).toBe("@nick.esselman");
  });

  it("rejects malformed and header-injected email addresses", () => {
    const malformed = validateContactForm(
      form({ ...base, contactMethod: "email", email: "not-an-email" })
    );
    const injected = validateContactForm(
      form({
        ...base,
        contactMethod: "email",
        email: "nick@example.com\r\nBcc: attacker@example.com"
      })
    );

    expect(malformed.ok).toBe(false);
    expect(injected.ok).toBe(false);
  });

  it("rejects unknown methods, oversized messages, and name header breaks", () => {
    expect(
      validateContactForm(form({ ...base, contactMethod: "telegram" })).ok
    ).toBe(false);
    expect(
      validateContactForm(form({ ...base, message: "x".repeat(5001) })).ok
    ).toBe(false);
    expect(
      validateContactForm(form({ ...base, name: "Nick\r\nBcc" })).ok
    ).toBe(false);
  });

  it("drops unknown source values", () => {
    const result = validateContactForm(form({ ...base, source: "attacker.example" }));
    expect(result.ok && result.submission.source).toBe(null);
  });
});
