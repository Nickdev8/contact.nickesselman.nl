import nodemailer from "nodemailer";

const requiredVariables = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "EMAIL_TO"
];

const missingVariables = requiredVariables.filter((name) => !process.env[name]?.trim());
if (missingVariables.length) {
  console.error(`Missing mail settings: ${missingVariables.join(", ")}`);
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("SMTP_PORT must be a valid port number.");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD.replace(/\s+/g, "")
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

try {
  await transporter.verify();
  console.log("SMTP connection and authentication succeeded.");

  if (process.argv.includes("--send")) {
    const timestamp = new Date().toISOString();
    const result = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_TO,
      subject: "Contact form delivery test",
      text: [
        "This is a delivery test from contact.nickesselman.nl.",
        "",
        `Sent at: ${timestamp}`,
        "If you received this message, SMTP authentication and delivery are working."
      ].join("\n")
    });

    console.log(`Test message accepted. Message ID: ${result.messageId}`);
  } else {
    console.log("No message sent. Add -- --send to send a labeled test email.");
  }
} catch (error) {
  console.error("Mail test failed", {
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    message: error?.message
  });
  process.exitCode = 1;
} finally {
  transporter.close();
}
