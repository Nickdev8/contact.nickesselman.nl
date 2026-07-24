import { randomBytes } from "node:crypto";
import type { Handle } from "@sveltejs/kit";

const appendNonce = (policy: string, nonce: string) => {
  const source = `'nonce-${nonce}'`;
  return policy.replace(/script-src ([^;]+)/, (_match, values: string) => {
    return `script-src ${values} ${source}`;
  });
};

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.cspNonce = randomBytes(16).toString("base64");
  const original = await resolve(event);
  const response = new Response(original.body, original);
  const contentSecurityPolicy = response.headers.get("content-security-policy");

  if (contentSecurityPolicy) {
    response.headers.set(
      "content-security-policy",
      appendNonce(contentSecurityPolicy, event.locals.cspNonce)
    );
  }

  response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("x-frame-options", "DENY");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  if (response.status >= 400) {
    response.headers.set("x-robots-tag", "noindex, noarchive");
  }

  if (response.headers.get("content-type")?.includes("text/html")) {
    response.headers.set("cache-control", "private, no-store");
  }

  return response;
};
