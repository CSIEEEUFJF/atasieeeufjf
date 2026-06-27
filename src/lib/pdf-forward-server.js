import crypto from "node:crypto";

export const MAX_DETAIL_LENGTH = 800;
export const DEFAULT_CHAPTER = "Ramo";

export function getForwardUrl() {
  return process.env.PDF_FORWARD_URL || process.env.PDF_UPLOAD_URL || "";
}

export function getForwardToken() {
  return process.env.PDF_FORWARD_TOKEN || process.env.PDF_UPLOAD_TOKEN || "";
}

export function parseMetadataValue(value) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ?parsed : {};
  } catch {
    return {};
  }
}

export function normalizeChapter(value) {
  const cleanValue = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^0-9A-Za-z._-]+/g, "")
    .replace(/^\.+|\.+$/g, "");

  return cleanValue && cleanValue !== "." && cleanValue !== ".." ?cleanValue : DEFAULT_CHAPTER;
}

export function buildStorageMetadata(metadata) {
  const chapter = normalizeChapter(metadata.sociedade || metadata.chapter || metadata.capitulo);

  return {
    ...metadata,
    capitulo: chapter,
    chapter,
    targetFolder: `/atas/${chapter}`,
  };
}

export function summarizeResponseText(text) {
  return String(text || "").trim().slice(0, MAX_DETAIL_LENGTH);
}

export function createUploadToken(metadata, options = {}) {
  const secret = getForwardToken().trim();
  if (!secret) {
    return "";
  }

  const ttlSeconds = Number(options.ttlSeconds || process.env.PDF_FORWARD_TOKEN_TTL_SECONDS || 300);
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(30, ttlSeconds);
  const payload = Buffer.from(
    JSON.stringify({
      chapter: metadata.chapter,
      exp: expiresAt,
      fileName: metadata.fileName,
      targetFolder: metadata.targetFolder,
    }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

  return `v1.${payload}.${signature}`;
}
