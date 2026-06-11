import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
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
  const parsed = path.parse(String(value || "ata.pdf"));
  const stem = sanitizeSegment(parsed.name, `ata-${Date.now()}`);
  const ext = parsed.ext.toLowerCase() === ".pdf" ? ".pdf" : ".pdf";

  return `${stem}${ext}`;
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

function assertInsideBaseDir(targetPath) {
  const relative = path.relative(ATAS_DIR, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho de destino invalido.");
  }
}

async function savePdf({ chapter, fileName, metadata, pdfBuffer }) {
  const chapterDir = path.join(ATAS_DIR, chapter);
  assertInsideBaseDir(chapterDir);
  await mkdir(chapterDir, { recursive: true });

  const safeFileName = sanitizeFileName(fileName);
  const uniquePrefix = new Date().toISOString().replace(/[:.]/g, "-");
  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const finalFileName = `${uniquePrefix}-${randomSuffix}-${safeFileName}`;
  const pdfPath = path.join(chapterDir, finalFileName);
  assertInsideBaseDir(pdfPath);

  const metadataPath = pdfPath.replace(/\.pdf$/i, ".metadata.json");
  await writeFile(pdfPath, pdfBuffer);
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        ...metadata,
        capitulo: chapter,
        chapter,
        originalFileName: fileName,
        savedAt: new Date().toISOString(),
        targetFolder: `/atas/${chapter}`,
      },
      null,
      2,
    ),
  );

  return { finalFileName, metadataPath, pdfPath };
}

function requireToken(request, response, next) {
  if (!RECEIVE_TOKEN) {
    next();
    return;
  }

  const expected = `Bearer ${RECEIVE_TOKEN}`;
  if (request.get("authorization") !== expected) {
    response.status(401).json({ detail: "Token invalido." });
    return;
  }

  next();
}

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
    const fileName = metadata.fileName || request.file.originalname || "ata.pdf";
    const saved = await savePdf({
      chapter,
      fileName,
      metadata,
      pdfBuffer: request.file.buffer,
    });

    response.status(201).json({
      capitulo: chapter,
      chapter,
      fileName: saved.finalFileName,
      ok: true,
      path: saved.pdfPath,
      targetFolder: `/atas/${chapter}`,
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
