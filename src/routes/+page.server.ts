import { fail } from "@sveltejs/kit";
import nodemailer from "nodemailer";
import type { Actions, PageServerLoad } from "./$types";
import { sourceLabel } from "$lib/contactContext";
import { validateContactForm } from "$lib/contactValidation";
import { getContactConfig, getTurnstileSiteKey } from "$lib/server/contactConfig";
import { contactRateLimiter } from "$lib/server/contactRateLimit";
import { verifyTurnstile } from "$lib/server/turnstile";

export const prerender = false;

const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 20_000;
const SMTP_MAX_ATTEMPTS = 2;

const getMailErrorDetails = (error: unknown) => {
  if (!(error instanceof Error)) return { type: "unknown" };

  const mailError = error as Error & {
    code?: string;
    command?: string;
    responseCode?: number;
  };

  return {
    name: mailError.name,
    code: mailError.code,
    command: mailError.command,
    responseCode: mailError.responseCode
  };
};

const isSafeToRetry = (error: unknown) => {
  const mailError = error as { code?: string; command?: string };
  return (
    ["ECONNECTION", "ECONNREFUSED", "EDNS"].includes(mailError?.code ?? "") ||
    (mailError?.code === "ETIMEDOUT" && (!mailError.command || mailError.command === "CONN"))
  );
};

const sendMailWithRetry = async (
  transporter: ReturnType<typeof nodemailer.createTransport>,
  mail: Parameters<typeof transporter.sendMail>[0],
  requestId: string
) => {
  for (let attempt = 1; attempt <= SMTP_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await transporter.sendMail(mail);
    } catch (error) {
      const willRetry = attempt < SMTP_MAX_ATTEMPTS && isSafeToRetry(error);
      console.error("Contact delivery attempt failed", {
        requestId,
        attempt,
        willRetry,
        ...getMailErrorDetails(error)
      });

      if (!willRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  throw new Error("Contact delivery exhausted all attempts.");
};

export const load: PageServerLoad = async ({ locals }) => ({
  turnstileSiteKey: getTurnstileSiteKey(),
  cspNonce: locals.cspNonce
});

export const actions: Actions = {
  default: async ({ request, fetch, getClientAddress, setHeaders }) => {
    const requestId = crypto.randomUUID();
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (!contentType.startsWith("application/x-www-form-urlencoded")) {
      return fail(415, { error: "This form only accepts text submissions." });
    }

    const data = await request.formData();

    if ((data.get("subject")?.toString() ?? "").trim()) {
      return { success: true, message: "Your message was sent successfully." };
    }

    const validation = validateContactForm(data);
    if (!validation.ok) {
      return fail(400, { error: validation.error });
    }

    const config = getContactConfig();
    if (!config.ok) {
      console.error("Contact service configuration is incomplete", {
        requestId,
        missing: config.missing
      });
      return fail(503, { error: "The contact form is unavailable. Please use email instead." });
    }

    let remoteIp: string;
    try {
      remoteIp = getClientAddress();
    } catch {
      console.error("Trusted client address is unavailable", { requestId });
      return fail(503, { error: "The contact form is unavailable. Please use email instead." });
    }

    const turnstileToken = data.get("cf-turnstile-response")?.toString() ?? "";
    const verification = await verifyTurnstile({
      fetch,
      token: turnstileToken,
      secret: config.turnstile.secret,
      remoteIp,
      requestId,
      expectedHostname: config.turnstile.hostname,
      expectedAction: config.turnstile.action
    });

    if (!verification.ok) {
      console.warn("Turnstile rejected a contact submission", {
        requestId,
        codes: verification.codes
      });
      return fail(verification.status, { error: verification.error });
    }

    const rateLimit = contactRateLimiter.consume(remoteIp);
    if (!rateLimit.allowed) {
      setHeaders({ "retry-after": String(rateLimit.retryAfterSeconds) });
      return fail(429, { error: "Too many messages were sent. Please wait before trying again." });
    }

    if (!contactRateLimiter.acquireDeliverySlot()) {
      setHeaders({ "retry-after": "30" });
      return fail(503, { error: "The contact form is busy. Please try again shortly." });
    }

    const submission = validation.submission;
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      requireTLS: !config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password
      },
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true
      },
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS
    });

    const contactSummary =
      submission.method === "none"
        ? "No reply requested"
        : `${submission.method}: ${submission.detail}`;
    const timestamp = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Europe/Amsterdam"
    }).format(new Date());
    const fullText = [
      submission.source ? `Source: ${sourceLabel(submission.source)}` : "Source: direct visit",
      "",
      `Preferred reply: ${contactSummary}`,
      "",
      "Message:",
      submission.message,
      "",
      "---",
      `Sent on: ${timestamp}`,
      `Sender name: ${submission.name}`
    ].join("\n");

    try {
      const delivery = await sendMailWithRetry(
        transporter,
        {
          from: config.smtp.from,
          to: config.smtp.to,
          ...(submission.method === "email" && submission.detail
            ? { replyTo: { name: submission.name, address: submission.detail } }
            : {}),
          subject: `Contact form${submission.source ? ` from ${submission.source}` : ""} (${submission.method})`,
          text: fullText,
          disableFileAccess: true,
          disableUrlAccess: true
        },
        requestId
      );

      if (!delivery.accepted.length || delivery.rejected.length) {
        throw Object.assign(new Error("Configured recipient was not accepted."), {
          code: "ERECIPIENT"
        });
      }

      console.info("Contact email accepted", { requestId });
      return { success: true, message: "Message sent. I will read it soon." };
    } catch (error) {
      console.error("Contact delivery failed", {
        requestId,
        ...getMailErrorDetails(error)
      });
      return fail(502, { error: "The message could not be delivered. Please use email instead." });
    } finally {
      transporter.close();
      contactRateLimiter.releaseDeliverySlot();
    }
  }
};
