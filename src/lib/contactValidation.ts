import {
  CONTACT_METHODS,
  FIELD_LIMITS,
  normalizeSource,
  type ContactMethod,
  type ContactSource
} from "./contactContext.js";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_INPUT_PATTERN = /^[+0-9\s().-]+$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const INSTAGRAM_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const HEADER_BREAKS = /[\r\n]/;

export type ContactSubmission = {
  name: string;
  message: string;
  method: ContactMethod;
  detail: string | null;
  source: ContactSource | null;
  honeypot: string;
};

export type ContactValidationResult =
  | { ok: true; submission: ContactSubmission }
  | { ok: false; error: string };

const getText = (data: FormData, key: string) => {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const hasHeaderBreaks = (value: string) => HEADER_BREAKS.test(value);

const normalizePhone = (value: string) => {
  if (!PHONE_INPUT_PATTERN.test(value)) return null;

  let normalized = value.replace(/[\s().-]/g, "");
  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  return PHONE_PATTERN.test(normalized) ? normalized : null;
};

export const validateContactForm = (data: FormData): ContactValidationResult => {
  const honeypot = getText(data, "subject");
  const name = getText(data, "name");
  const message = getText(data, "message");
  const rawMethod = getText(data, "contactMethod").toLowerCase();
  const rawDetail =
    rawMethod === "email" ? getText(data, "email") : getText(data, "contactDetail");

  if (!name || name.length > FIELD_LIMITS.name || hasHeaderBreaks(name)) {
    return { ok: false, error: `Enter a name of up to ${FIELD_LIMITS.name} characters.` };
  }

  if (!message || message.length > FIELD_LIMITS.message) {
    return {
      ok: false,
      error: `Enter a message of up to ${FIELD_LIMITS.message.toLocaleString("en")} characters.`
    };
  }

  if (!CONTACT_METHODS.includes(rawMethod as ContactMethod)) {
    return { ok: false, error: "Select a valid reply method." };
  }

  const method = rawMethod as ContactMethod;
  let detail: string | null = null;

  if (method === "email") {
    if (
      !rawDetail ||
      rawDetail.length > FIELD_LIMITS.email ||
      hasHeaderBreaks(rawDetail) ||
      !EMAIL_PATTERN.test(rawDetail)
    ) {
      return { ok: false, error: "Enter a valid email address." };
    }

    detail = rawDetail;
  } else if (method === "sms" || method === "whatsapp" || method === "phone") {
    const phone = normalizePhone(rawDetail);
    if (!phone) {
      return { ok: false, error: "Enter a valid phone number, including its country code." };
    }

    detail = phone;
  } else if (method === "instagram") {
    const handle = rawDetail.replace(/^@/, "");
    if (!INSTAGRAM_PATTERN.test(handle)) {
      return { ok: false, error: "Enter a valid Instagram username." };
    }

    detail = `@${handle}`;
  }

  return {
    ok: true,
    submission: {
      name,
      message,
      method,
      detail,
      source: normalizeSource(getText(data, "source")),
      honeypot
    }
  };
};
