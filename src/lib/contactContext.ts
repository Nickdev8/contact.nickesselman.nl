const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export const IMAGE_LIMITS = {
  maxFiles: 4,
  maxBytesPerFile: 3_500_000,
  maxBytesTotal: 10_000_000,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] as const
};

const decodeSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const normalizeSource = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const cleaned = decodeSafe(value)
    .replace(CONTROL_CHARS, " ")
    .replace(/^https?:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return cleaned || null;
};

export const buildPresetMessage = (params: URLSearchParams) => {
  const image = params.get("image");
  if (image) {
    return `I would like to report this image.\nImage URL: ${decodeSafe(image)}\nReason:`;
  }

  const report = params.get("report");
  if (report) {
    return `I would like to report: ${decodeSafe(report)}\nReason:`;
  }

  const project = params.get("project");
  if (project) {
    return `I would like to report this project on the Experiences page: ${decodeSafe(project)}\nReason:`;
  }

  return "";
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};
