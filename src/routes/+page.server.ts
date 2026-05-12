import { dev } from "$app/environment";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import nodemailer from "nodemailer";
import { formatBytes, IMAGE_LIMITS, normalizeSource } from "$lib/contactContext";

export const prerender = false;

const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const sanitizeAttachmentName = (name: string, index: number) => {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || `image-${index + 1}`;
};

const sanitizeHeaderText = (value: string) =>
  value.replace(/[\r\n"]/g, " ").replace(/\s+/g, " ").trim();

const getTurnstileSiteKey = () =>
  dev ? TURNSTILE_TEST_SITE_KEY : publicEnv.PUBLIC_TURNSTILE_SITE_KEY ?? "";

const getTurnstileSecretKey = () =>
  dev ? TURNSTILE_TEST_SECRET_KEY : privateEnv.TURNSTILE_SECRET_KEY ?? "";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_VERIFY_TIMEOUT_MS = 8000;

type TurnstileVerificationResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

type TurnstileVerificationResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { value: error };
};

const verifyTurnstileToken = async ({
  fetch,
  token,
  secretKey,
  siteKey,
  remoteIp
}: {
  fetch: typeof globalThis.fetch;
  token: string;
  secretKey: string;
  siteKey: string;
  remoteIp?: string;
}): Promise<TurnstileVerificationResult> => {
  const verificationBody = new URLSearchParams({
    secret: secretKey,
    response: token
  });

  if (remoteIp) verificationBody.set("remoteip", remoteIp);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort("timeout"), TURNSTILE_VERIFY_TIMEOUT_MS);

  console.info("Turnstile verification started", {
    url: TURNSTILE_VERIFY_URL,
    hasTurnstileSiteKey: Boolean(siteKey),
    hasTurnstileSecretKey: Boolean(secretKey),
    includesRemoteIp: Boolean(remoteIp)
  });

  try {
    const verificationResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: verificationBody,
      signal: abortController.signal
    });

    const rawBody = await verificationResponse.text();

    let verification: TurnstileVerificationResponse = {};
    if (rawBody) {
      try {
        verification = JSON.parse(rawBody) as TurnstileVerificationResponse;
      } catch {
        console.warn("Turnstile verification returned a non-JSON response", {
          status: verificationResponse.status,
          body: rawBody.slice(0, 500)
        });
      }
    }

    if (!verificationResponse.ok) {
      console.warn("Turnstile verification returned a non-OK response", {
        status: verificationResponse.status,
        errorCodes: verification["error-codes"] ?? [],
        body: rawBody.slice(0, 500)
      });

      return {
        ok: false,
        status: 400,
        error: "Captcha verification failed. Please try again."
      };
    }

    if (!verification.success) {
      console.warn("Turnstile verification rejected the token", {
        status: verificationResponse.status,
        errorCodes: verification["error-codes"] ?? []
      });

      return {
        ok: false,
        status: 400,
        error: "Captcha verification failed. Please try again."
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Turnstile verification request failed", {
      ...serializeError(error),
      url: TURNSTILE_VERIFY_URL,
      hasTurnstileSiteKey: Boolean(siteKey),
      hasTurnstileSecretKey: Boolean(secretKey),
      includesRemoteIp: Boolean(remoteIp)
    });

    return {
      ok: false,
      status: 502,
      error: "Spam check could not be completed right now. Please try again."
    };
  } finally {
    clearTimeout(timeout);
  }
};

const createTransporter = () => {
  if (
    !privateEnv.SMTP_HOST ||
    !privateEnv.SMTP_PORT ||
    !privateEnv.SMTP_USER ||
    !privateEnv.SMTP_PASSWORD ||
    !privateEnv.EMAIL_FROM ||
    !privateEnv.EMAIL_TO
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: privateEnv.SMTP_HOST,
    port: Number(privateEnv.SMTP_PORT),
    secure: privateEnv.SMTP_SECURE === "true",
    auth: {
      user: privateEnv.SMTP_USER,
      pass: privateEnv.SMTP_PASSWORD
    }
  });
};

export const load: PageServerLoad = async () => ({
  turnstileSiteKey: getTurnstileSiteKey()
});

export const actions: Actions = {
  default: async ({ request, fetch, getClientAddress }) => {
    const data = await request.formData();

    if ((data.get("subject")?.toString() ?? "").trim()) {
      return { success: true, message: "Your message was sent successfully." };
    }

    const transporter = createTransporter();
    if (!transporter) {
      console.error("Contact form is missing SMTP configuration.");
      return fail(500, { error: "Mail delivery is not configured right now." });
    }

    const name = data.get("name")?.toString().trim() || "Anonymous";
    const message = data.get("message")?.toString().trim() || "";
    const method = data.get("contactMethod")?.toString().trim().toLowerCase();
    const detail = data.get("contactDetail")?.toString().trim() || "";
    const source = normalizeSource(data.get("source")?.toString());
    const turnstileToken = data.get("cf-turnstile-response")?.toString();
    const imageFiles = data
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (imageFiles.length > IMAGE_LIMITS.maxFiles) {
      return fail(400, {
        error: `Attach up to ${IMAGE_LIMITS.maxFiles} images per message.`
      });
    }

    const invalidImage = imageFiles.find((file) => !IMAGE_LIMITS.acceptedTypes.includes(file.type as (typeof IMAGE_LIMITS.acceptedTypes)[number]));
    if (invalidImage) {
      return fail(400, {
        error: "Only PNG, JPG, WEBP, and GIF images are supported."
      });
    }

    const oversizedImage = imageFiles.find((file) => file.size > IMAGE_LIMITS.maxBytesPerFile);
    if (oversizedImage) {
      return fail(400, {
        error: `Each image must stay under ${formatBytes(IMAGE_LIMITS.maxBytesPerFile)}.`
      });
    }

    const totalImageBytes = imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalImageBytes > IMAGE_LIMITS.maxBytesTotal) {
      return fail(400, {
        error: `Images must stay under ${formatBytes(IMAGE_LIMITS.maxBytesTotal)} total.`
      });
    }

    if (!message) {
      return fail(400, { error: "Please include a message." });
    }

    if (!method) {
      return fail(400, { error: "Please select a contact method." });
    }

    const turnstileSiteKey = getTurnstileSiteKey();
    const turnstileSecretKey = getTurnstileSecretKey();
    const shouldVerifyTurnstile = !dev && Boolean(turnstileSiteKey && turnstileSecretKey);

    if (shouldVerifyTurnstile) {
      if (!turnstileToken) {
        return fail(400, { error: "Please confirm you are not a bot." });
      }

      let remoteIp: string | undefined;
      try {
        remoteIp = getClientAddress() || undefined;
      } catch {
        // Some adapters may not expose a client IP.
      }

      const verification = await verifyTurnstileToken({
        fetch,
        token: turnstileToken,
        secretKey: turnstileSecretKey,
        siteKey: turnstileSiteKey,
        remoteIp
      });

      if (!verification.ok) {
        return fail(verification.status, { error: verification.error });
      }
    }

    let replyTo: string | undefined;
    let contactSummary = "";
    const safeName = sanitizeHeaderText(name) || "Anonymous";

    switch (method) {
      case "email": {
        const email = data.get("email")?.toString().trim();
        if (!email) {
          return fail(400, { error: "Please provide your email address." });
        }

        replyTo = `"${safeName}" <${email}>`;
        contactSummary = `Contact via email: ${email}`;
        break;
      }

      case "sms":
      case "whatsapp":
      case "phone":
      case "instagram":
        if (!detail) {
          return fail(400, { error: "Please provide your contact details." });
        }

        contactSummary = `Contact via ${method}: ${detail}`;
        break;

      case "none":
        contactSummary = "User requested: do not contact them back.";
        break;

      default:
        return fail(400, { error: "Unknown contact method." });
    }

    const attachments = await Promise.all(
      imageFiles.map(async (file, index) => ({
        filename: sanitizeAttachmentName(file.name, index),
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type
      }))
    );

    const timestamp = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Europe/Amsterdam"
    }).format(new Date());

    const fullText = [
      source ? `Source: ${source}` : "Source: direct visit",
      "",
      "Preferred contact method:",
      contactSummary,
      "",
      "Message:",
      message,
      "",
      "Image attachments:",
      imageFiles.length
        ? imageFiles.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")
        : "None",
      "",
      "---",
      `Sent on: ${timestamp}`,
      `Sender name: ${safeName}`
    ].join("\n");

    try {
      await transporter.sendMail({
        from: privateEnv.EMAIL_FROM,
        to: privateEnv.EMAIL_TO,
        ...(replyTo ? { replyTo } : {}),
        subject: `Contact form${source ? ` from ${source}` : ""} (${method}${imageFiles.length ? `, ${imageFiles.length} image${imageFiles.length === 1 ? "" : "s"}` : ""})`,
        text: fullText,
        attachments
      });

      return {
        success: true,
        message: imageFiles.length
          ? `Message sent with ${imageFiles.length} image attachment${imageFiles.length === 1 ? "" : "s"}.`
          : "Message sent. I will read it soon."
      };
    } catch (error) {
      console.error("Email send failed:", error);
      return fail(500, { error: "Failed to send message. Please try again later." });
    }
  }
};
