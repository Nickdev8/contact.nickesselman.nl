import { fail } from "@sveltejs/kit";
import type { Actions } from "./$types";
import nodemailer from "nodemailer";
import { env } from "$env/dynamic/private";
import { formatBytes, IMAGE_LIMITS, normalizeSource } from "$lib/contactContext";

export const prerender = false;

const sanitizeAttachmentName = (name: string, index: number) => {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || `image-${index + 1}`;
};

const sanitizeHeaderText = (value: string) =>
  value.replace(/[\r\n"]/g, " ").replace(/\s+/g, " ").trim();

const createTransporter = () => {
  if (
    !env.SMTP_HOST ||
    !env.SMTP_PORT ||
    !env.SMTP_USER ||
    !env.SMTP_PASSWORD ||
    !env.EMAIL_FROM ||
    !env.EMAIL_TO
  ) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === "true",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    }
  });
};

export const actions: Actions = {
  default: async ({ request }) => {
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
        from: env.EMAIL_FROM,
        to: env.EMAIL_TO,
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
