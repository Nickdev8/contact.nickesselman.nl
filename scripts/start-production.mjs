import { readFileSync } from "node:fs";

const readSetting = (name) => {
  const direct = process.env[name]?.trim();
  if (direct) return direct;

  const path = process.env[`${name}_FILE`]?.trim();
  if (!path) return "";

  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
};

const required = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "EMAIL_TO",
  "PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY"
];
const missing = required.filter((name) => !readSetting(name));

if (process.env.ORIGIN !== "https://contact.nickesselman.nl") {
  missing.push("ORIGIN=https://contact.nickesselman.nl");
}

if (process.env.ADDRESS_HEADER?.toLowerCase() !== "cf-connecting-ip") {
  missing.push("ADDRESS_HEADER=CF-Connecting-IP");
}

const port = Number(readSetting("SMTP_PORT"));
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  missing.push("valid SMTP_PORT");
}

if (missing.length) {
  console.error(`Contact service refused to start; missing or invalid: ${[...new Set(missing)].join(", ")}`);
  process.exit(1);
}

await import("../build/index.js");
