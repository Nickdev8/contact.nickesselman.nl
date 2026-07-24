const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export const CONTACT_METHODS = [
  "email",
  "whatsapp",
  "sms",
  "instagram",
  "phone",
  "none"
] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number];
export type ContactSource = "portfolio" | "blog";

export const FIELD_LIMITS = {
  name: 100,
  email: 254,
  contactDetail: 100,
  instagram: 30,
  message: 5000,
  presetValue: 500
} as const;

const SOURCE_LABELS: Record<ContactSource, string> = {
  portfolio: "Nick’s portfolio",
  blog: "Nick’s blog"
};

const decodeSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const safePresetValue = (value: string) =>
  decodeSafe(value)
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, FIELD_LIMITS.presetValue);

export const normalizeSource = (value: string | null | undefined): ContactSource | null => {
  if (value === "portfolio" || value === "blog") {
    return value;
  }

  return null;
};

export const sourceLabel = (source: ContactSource) => SOURCE_LABELS[source];

export const buildPresetMessage = (params: URLSearchParams) => {
  const image = params.get("image");
  if (image) {
    return `I would like to report this image.\nImage URL: ${safePresetValue(image)}\nReason:`;
  }

  const report = params.get("report");
  if (report) {
    return `I would like to report: ${safePresetValue(report)}\nReason:`;
  }

  const project = params.get("project");
  if (project) {
    return `I would like to report this project: ${safePresetValue(project)}\nReason:`;
  }

  return "";
};
