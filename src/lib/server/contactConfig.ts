import { dev } from "$app/environment";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { readFileSync } from "node:fs";

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const readSetting = (name: string) => {
  const direct = privateEnv[name]?.trim();
  if (direct) return direct;

  const path = privateEnv[`${name}_FILE`]?.trim();
  if (!path) return "";

  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
};

const parsePort = (value: string) => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
};

const isSingleMailbox = (value: string) =>
  !/[\r\n,;]/.test(value) && EMAIL_PATTERN.test(value);

const isSingleFromAddress = (value: string) => {
  if (/[\r\n,;]/.test(value)) return false;

  const displayAddress = value.match(/^[^<>]{1,100}<([^<>]+)>$/);
  return displayAddress
    ? EMAIL_PATTERN.test(displayAddress[1].trim())
    : EMAIL_PATTERN.test(value);
};

export type ContactConfig =
  | {
      ok: true;
      turnstile: {
        siteKey: string;
        secret: string;
        hostname: string;
        action: string;
      };
      smtp: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        password: string;
        from: string;
        to: string;
      };
    }
  | { ok: false; missing: string[] };

export const getTurnstileSiteKey = () =>
  dev ? TURNSTILE_TEST_SITE_KEY : publicEnv.PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

export const getContactConfig = (): ContactConfig => {
  const siteKey = getTurnstileSiteKey();
  const secret = dev ? TURNSTILE_TEST_SECRET_KEY : readSetting("TURNSTILE_SECRET_KEY");
  const smtpHost = readSetting("SMTP_HOST");
  const smtpPort = parsePort(readSetting("SMTP_PORT"));
  const smtpUser = readSetting("SMTP_USER");
  const smtpPassword = readSetting("SMTP_PASSWORD").replace(/\s+/g, "");
  const emailFrom = readSetting("EMAIL_FROM");
  const emailTo = readSetting("EMAIL_TO");
  const missing: string[] = [];

  if (!siteKey) missing.push("PUBLIC_TURNSTILE_SITE_KEY");
  if (!secret) missing.push("TURNSTILE_SECRET_KEY");
  if (!smtpHost) missing.push("SMTP_HOST");
  if (!smtpPort) missing.push("SMTP_PORT");
  if (!smtpUser || !isSingleMailbox(smtpUser)) missing.push("SMTP_USER");
  if (!smtpPassword) missing.push("SMTP_PASSWORD");
  if (!emailFrom || !isSingleFromAddress(emailFrom)) missing.push("EMAIL_FROM");
  if (!emailTo || !isSingleMailbox(emailTo)) missing.push("EMAIL_TO");

  if (missing.length || !smtpPort) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    turnstile: {
      siteKey,
      secret,
      hostname: readSetting("TURNSTILE_EXPECTED_HOSTNAME") || "contact.nickesselman.nl",
      action: readSetting("TURNSTILE_EXPECTED_ACTION") || "contact"
    },
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: readSetting("SMTP_SECURE") === "true",
      user: smtpUser,
      password: smtpPassword,
      from: emailFrom,
      to: emailTo
    }
  };
};
