import crypto from "node:crypto";

import { normalizarNomeSaida, normalizarSociedadeChave, SOCIEDADES } from "./ata";

export const MAX_DETAIL_LENGTH = 800;
export const DEFAULT_CHAPTER = "Ramo";
const DEFAULT_MAX_FORWARD_PDF_BYTES = 12 * 1024 * 1024;
const configuredMaxForwardPdfBytes = Number(process.env.PDF_FORWARD_MAX_BYTES || DEFAULT_MAX_FORWARD_PDF_BYTES);
export const MAX_FORWARD_PDF_BYTES = Number.isFinite(configuredMaxForwardPdfBytes)
  ?Math.max(1024 * 1024, configuredMaxForwardPdfBytes)
  : DEFAULT_MAX_FORWARD_PDF_BYTES;

export class PdfForwardSecurityError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PdfForwardSecurityError";
    this.status = status;
  }
}

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
  const cleanValue = String(value || DEFAULT_CHAPTER).trim() || DEFAULT_CHAPTER;
  const chapter = normalizarSociedadeChave(cleanValue, "");

  if (!chapter || !SOCIEDADES[chapter]) {
    throw new PdfForwardSecurityError("Capítulo inválido para envio de PDF.", 400);
  }

  return chapter;
}

export function normalizePdfFileName(value) {
  const parsed = String(value || "ata.pdf").replace(/\.pdf$/i, "");
  return `${normalizarNomeSaida(parsed || "ata")}.pdf`;
}

export function buildStorageMetadata(metadata) {
  const chapter = normalizeChapter(metadata.sociedade || metadata.chapter || metadata.capitulo);
  const fileName = normalizePdfFileName(metadata.fileName);

  return {
    ...metadata,
    capitulo: chapter,
    chapter,
    fileName,
    targetFolder: `/atas/${chapter}`,
  };
}

export function assertUserCanForwardPdf(user, chapter) {
  if (!user) {
    throw new PdfForwardSecurityError("Autenticação necessária.", 401);
  }

  if (user.isAdmin || user.chapters?.includes(chapter)) {
    return;
  }

  throw new PdfForwardSecurityError("Seu usuário não tem acesso ao capítulo selecionado.", 403);
}

export async function assertForwardedPdfFile(pdf) {
  if (!pdf || typeof pdf.arrayBuffer !== "function" || typeof pdf.slice !== "function") {
    throw new PdfForwardSecurityError("Arquivo PDF não enviado.", 400);
  }

  const size = Number(pdf.size || 0);
  if (!Number.isFinite(size) || size <= 0) {
    throw new PdfForwardSecurityError("Arquivo PDF vazio.", 400);
  }

  if (size > MAX_FORWARD_PDF_BYTES) {
    throw new PdfForwardSecurityError("PDF maior que o limite permitido.", 413);
  }

  const headerBuffer = await pdf.slice(0, 5).arrayBuffer();
  const header = Buffer.from(headerBuffer).toString("ascii");
  if (header !== "%PDF-") {
    throw new PdfForwardSecurityError("Arquivo enviado não parece ser um PDF válido.", 400);
  }
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
      jti: crypto.randomUUID(),
      targetFolder: metadata.targetFolder,
    }),
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");

  return `v1.${payload}.${signature}`;
}
