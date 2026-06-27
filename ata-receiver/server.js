import crypto from "node:crypto";
import { access, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import express from "express";
import multer from "multer";

const app = express();
const upload = multer({
  limits: {
    fileSize: Number(process.env.MAX_PDF_BYTES || 25 * 1024 * 1024),
  },
  storage: multer.memoryStorage(),
});

const PORT = Number(process.env.PORT || 3001);
const ATAS_DIR = path.resolve(process.env.ATAS_DIR || "/atas");
const RECEIVE_TOKEN = String(process.env.RECEIVE_TOKEN || "").trim();
const CORS_ORIGIN = String(process.env.CORS_ORIGIN || "").trim();
const ALLOW_WILDCARD_CORS = String(process.env.ALLOW_WILDCARD_CORS || "") === "1";
const usedUploadTokenIds = new Map();

function parseJson(value) {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getAllowedOrigin(origin) {
  if (CORS_ORIGIN === "*" && ALLOW_WILDCARD_CORS) {
    return "*";
  }

  if (!CORS_ORIGIN) {
    return "";
  }

  const allowedOrigins = CORS_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
  return allowedOrigins.includes(origin) ? origin : allowedOrigins[0] || "";
}

function applyCors(request, response, next) {
  const allowedOrigin = getAllowedOrigin(request.get("origin") || "");
  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Expose-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");

  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }

  next();
}

function sanitizeSegment(value, fallback) {
  const cleaned = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^0-9A-Za-z._-]+/g, "")
    .replace(/^\.+|\.+$/g, "");

  return cleaned && cleaned !== "." && cleaned !== ".." ? cleaned : fallback;
}

function sanitizeFileName(value) {
  const safeValue = String(value || "ata.pdf").replace(/[\\/]+/g, "-");
  const parsed = path.parse(safeValue);
  const stem = sanitizeSegment(parsed.name, `ata-${Date.now()}`);
  const ext = parsed.ext.toLowerCase() === ".pdf" ? ".pdf" : ".pdf";

  return `${stem}${ext}`;
}

function getPreferredFileName({ fileName, metadata }) {
  return sanitizeFileName(metadata.title || metadata.titulo || metadata.fileName || fileName);
}

function getDedupeKey({ chapter, metadata }) {
  const ataId = String(metadata.ataId || metadata.id || "").trim();
  if (ataId) {
    return `ata:${chapter}:${ataId}`;
  }

  const title = sanitizeSegment(metadata.title || metadata.titulo || metadata.fileName, "");
  if (title) {
    return `title:${chapter}:${title.toLowerCase()}`;
  }

  return "";
}

function getChapter({ body, metadata }) {
  const fromTargetFolder = path.basename(String(body.targetFolder || metadata.targetFolder || ""));
  return sanitizeSegment(
    body.chapter
      || body.capitulo
      || metadata.chapter
      || metadata.capitulo
      || metadata.sociedade
      || fromTargetFolder,
    "Ramo",
  );
}

function targetFolderForChapter(chapter) {
  return `/atas/${chapter}`;
}

function assertPdfBuffer(pdfBuffer) {
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 5) {
    throw new Error("PDF vazio ou invalido.");
  }

  if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Arquivo enviado nao parece ser um PDF valido.");
  }
}

function assertSignedTokenMatchesRequest(payload, { chapter, fileName, targetFolder }) {
  if (!payload) {
    return;
  }

  if (payload.chapter && payload.chapter !== chapter) {
    throw new Error("Token nao corresponde ao capitulo enviado.");
  }

  if (payload.targetFolder && payload.targetFolder !== targetFolder) {
    throw new Error("Token nao corresponde a pasta de destino enviada.");
  }

  if (payload.fileName && sanitizeFileName(payload.fileName) !== sanitizeFileName(fileName)) {
    throw new Error("Token nao corresponde ao arquivo enviado.");
  }
}

function assertInsideBaseDir(targetPath) {
  const relative = path.relative(ATAS_DIR, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho de destino invalido.");
  }
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readMetadata(metadataPath) {
  try {
    return parseJson(await readFile(metadataPath, "utf8"));
  } catch {
    return {};
  }
}

function metadataMatchesDedupeKey({ chapter, dedupeKey, metadata }) {
  if (!dedupeKey) {
    return false;
  }

  return (
    metadata.dedupeKey === dedupeKey
    || getDedupeKey({ chapter, metadata }) === dedupeKey
  );
}

async function findExistingAta({ chapter, chapterDir, dedupeKey }) {
  if (!dedupeKey) {
    return null;
  }

  let entries = [];
  try {
    entries = await readdir(chapterDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".metadata.json")) {
      continue;
    }

    const metadataPath = path.join(chapterDir, entry.name);
    const metadata = await readMetadata(metadataPath);
    if (!metadataMatchesDedupeKey({ chapter, dedupeKey, metadata })) {
      continue;
    }

    const pdfPath = metadataPath.replace(/\.metadata\.json$/i, ".pdf");
    return {
      fileName: path.basename(pdfPath),
      metadata,
      metadataPath,
      pdfPath,
    };
  }

  return null;
}

async function getAvailablePdfPath({ chapterDir, dedupeKey, preferredFileName }) {
  const safeFileName = sanitizeFileName(preferredFileName);
  const firstPdfPath = path.join(chapterDir, safeFileName);
  assertInsideBaseDir(firstPdfPath);

  if (!(await fileExists(firstPdfPath))) {
    return {
      finalFileName: safeFileName,
      pdfPath: firstPdfPath,
    };
  }

  const parsed = path.parse(safeFileName);
  const suffix = crypto
    .createHash("sha256")
    .update(dedupeKey || `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`)
    .digest("hex")
    .slice(0, 8);
  const fallbackFileName = `${parsed.name}-${suffix}.pdf`;
  const fallbackPdfPath = path.join(chapterDir, fallbackFileName);
  assertInsideBaseDir(fallbackPdfPath);

  return {
    finalFileName: fallbackFileName,
    pdfPath: fallbackPdfPath,
  };
}

async function maybeRenameExistingAta({ chapter, existing, metadata, preferredFileName }) {
  const desiredFileName = sanitizeFileName(preferredFileName);
  const desiredPdfPath = path.join(path.dirname(existing.pdfPath), desiredFileName);
  const desiredMetadataPath = desiredPdfPath.replace(/\.pdf$/i, ".metadata.json");
  assertInsideBaseDir(desiredPdfPath);
  assertInsideBaseDir(desiredMetadataPath);

  if (path.resolve(existing.pdfPath) === path.resolve(desiredPdfPath)) {
    return existing;
  }

  if (await fileExists(desiredPdfPath)) {
    return existing;
  }

  await rename(existing.pdfPath, desiredPdfPath);
  await rename(existing.metadataPath, desiredMetadataPath);

  const updatedMetadata = {
    ...existing.metadata,
    ...metadata,
    capitulo: chapter,
    chapter,
    duplicateReceivedAt: new Date().toISOString(),
    fileName: desiredFileName,
    originalFileName: existing.metadata.originalFileName || metadata.fileName || desiredFileName,
    targetFolder: `/atas/${chapter}`,
  };
  await writeFile(desiredMetadataPath, JSON.stringify(updatedMetadata, null, 2));

  return {
    fileName: desiredFileName,
    metadata: updatedMetadata,
    metadataPath: desiredMetadataPath,
    pdfPath: desiredPdfPath,
  };
}

function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifySignedToken(token) {
  if (!RECEIVE_TOKEN || !token.startsWith("v1.")) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [, payload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", RECEIVE_TOKEN)
    .update(payload)
    .digest("base64url");

  if (!timingSafeEqualString(signature, expectedSignature)) {
    return null;
  }

  const parsedPayload = parseJson(Buffer.from(payload, "base64url").toString("utf8"));
  if (
    !parsedPayload.jti
    || !parsedPayload.exp
    || Number(parsedPayload.exp) < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  return parsedPayload;
}

function cleanupUsedUploadTokenIds(nowSeconds) {
  for (const [jti, expiresAt] of usedUploadTokenIds.entries()) {
    if (Number(expiresAt) < nowSeconds) {
      usedUploadTokenIds.delete(jti);
    }
  }
}

function markSignedTokenAsUsed(payload) {
  if (!payload?.jti) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  cleanupUsedUploadTokenIds(nowSeconds);

  if (usedUploadTokenIds.has(payload.jti)) {
    return false;
  }

  usedUploadTokenIds.set(payload.jti, Number(payload.exp) || nowSeconds + 300);
  return true;
}

async function savePdf({ chapter, fileName, metadata, pdfBuffer }) {
  const chapterDir = path.join(ATAS_DIR, chapter);
  assertInsideBaseDir(chapterDir);
  await mkdir(chapterDir, { recursive: true });

  const preferredFileName = getPreferredFileName({ fileName, metadata });
  const dedupeKey = getDedupeKey({ chapter, metadata });
  const pdfSha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  const existing = await findExistingAta({ chapter, chapterDir, dedupeKey });
  if (existing) {
    const renamedExisting = await maybeRenameExistingAta({
      chapter,
      existing,
      metadata,
      preferredFileName,
    });
    const pdfChanged = renamedExisting.metadata.pdfSha256 !== pdfSha256;
    if (pdfChanged) {
      await writeFile(renamedExisting.pdfPath, pdfBuffer);
    }

    const updatedMetadata = {
      ...renamedExisting.metadata,
      ...metadata,
      capitulo: chapter,
      chapter,
      dedupeKey,
      duplicateReceivedAt: new Date().toISOString(),
      fileName: renamedExisting.fileName,
      originalFileName: renamedExisting.metadata.originalFileName || fileName,
      pdfSha256,
      targetFolder: `/atas/${chapter}`,
      updatedAt: pdfChanged ? new Date().toISOString() : renamedExisting.metadata.updatedAt,
    };
    await writeFile(renamedExisting.metadataPath, JSON.stringify(updatedMetadata, null, 2));

    return {
      duplicate: true,
      finalFileName: renamedExisting.fileName,
      metadataPath: renamedExisting.metadataPath,
      pdfPath: renamedExisting.pdfPath,
      updated: pdfChanged,
    };
  }

  const { finalFileName, pdfPath } = await getAvailablePdfPath({
    chapterDir,
    dedupeKey,
    preferredFileName,
  });

  const metadataPath = pdfPath.replace(/\.pdf$/i, ".metadata.json");
  await writeFile(pdfPath, pdfBuffer, { flag: "wx" });
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        ...metadata,
        capitulo: chapter,
        chapter,
        dedupeKey,
        fileName: finalFileName,
        originalFileName: fileName,
        pdfSha256,
        savedAt: new Date().toISOString(),
        targetFolder: `/atas/${chapter}`,
      },
      null,
      2,
    ),
  );

  return { duplicate: false, finalFileName, metadataPath, pdfPath, updated: false };
}

function requireToken(request, response, next) {
  if (!RECEIVE_TOKEN) {
    response.status(503).json({ detail: "RECEIVE_TOKEN nao configurado." });
    return;
  }

  const authorization = String(request.get("authorization") || "");
  const bearerPrefix = "Bearer ";
  const receivedToken = authorization.startsWith(bearerPrefix)
    ? authorization.slice(bearerPrefix.length)
    : "";

  if (timingSafeEqualString(receivedToken, RECEIVE_TOKEN)) {
    next();
    return;
  }

  const signedTokenPayload = verifySignedToken(receivedToken);
  if (!signedTokenPayload) {
    response.status(401).json({ detail: "Token invalido." });
    return;
  }

  if (!markSignedTokenAsUsed(signedTokenPayload)) {
    response.status(401).json({ detail: "Token ja utilizado." });
    return;
  }

  request.uploadTokenPayload = signedTokenPayload;
  next();
}

app.use(applyCors);

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "ata-receiver" });
});

app.post("/atas/pdf", requireToken, upload.single("pdf"), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ detail: "Campo multipart 'pdf' e obrigatorio." });
      return;
    }

    const metadata = parseJson(request.body.metadata);
    const chapter = getChapter({ body: request.body, metadata });
    const targetFolder = targetFolderForChapter(chapter);
    const fileName = metadata.fileName || request.file.originalname || "ata.pdf";

    try {
      assertPdfBuffer(request.file.buffer);
      assertSignedTokenMatchesRequest(request.uploadTokenPayload, {
        chapter,
        fileName,
        targetFolder,
      });
    } catch (error) {
      response.status(403).json({ detail: error.message || "Upload recusado." });
      return;
    }

    const saved = await savePdf({
      chapter,
      fileName,
      metadata,
      pdfBuffer: request.file.buffer,
    });

    response.status(saved.duplicate ? 200 : 201).json({
      capitulo: chapter,
      chapter,
      duplicate: saved.duplicate,
      fileName: saved.finalFileName,
      ok: true,
      path: saved.pdfPath,
      targetFolder,
      updated: saved.updated,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    response.status(400).json({ detail: error.message });
    return;
  }

  response.status(500).json({
    detail: error.message || "Falha ao salvar ata.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ata-receiver listening on ${PORT}, saving files under ${ATAS_DIR}`);
});
