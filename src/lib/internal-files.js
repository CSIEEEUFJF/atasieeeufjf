import crypto from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPrisma } from "./db";

const DEFAULT_MAX_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_STORAGE_ROOT = path.join(process.cwd(), ".data", "internal-storage");
const STORAGE_ROOT = process.env.INTERNAL_STORAGE_DIR
  ? path.resolve(/* turbopackIgnore: true */ process.env.INTERNAL_STORAGE_DIR)
  : DEFAULT_STORAGE_ROOT;
const MAX_FILE_BYTES = Number(process.env.INTERNAL_STORAGE_MAX_BYTES || DEFAULT_MAX_FILE_BYTES);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".yml",
  ".yaml",
  ".tex",
  ".bib",
  ".cls",
  ".sty",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".css",
  ".html",
  ".java",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".rb",
  ".rs",
  ".go",
  ".sql",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".tar",
  ".gz",
  ".tgz",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".apk",
  ".app",
  ".bat",
  ".bin",
  ".cgi",
  ".cmd",
  ".com",
  ".dll",
  ".dmg",
  ".exe",
  ".iso",
  ".jar",
  ".msi",
  ".phtml",
  ".php",
  ".ps1",
  ".scr",
  ".sh",
]);

function cleanFileName(value) {
  const safeValue = String(value || "arquivo.bin").replace(/[\\/]+/g, "-");
  const parsed = path.parse(safeValue);
  const stem = parsed.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^0-9A-Za-z._-]+/g, "")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120);
  const ext = parsed.ext.toLowerCase().slice(0, 20);

  return `${stem || "arquivo"}${ext || ".bin"}`;
}

function userStorageSegment(user) {
  return `user-${Number(user.id)}`;
}

function assertInsideStorage(targetPath) {
  const relative = path.relative(STORAGE_ROOT, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Caminho de arquivo inválido.");
  }
}

function categoryForExtension(extension) {
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) return "image";
  if ([".tex", ".bib", ".cls", ".sty"].includes(extension)) return "latex";
  if ([".zip", ".tar", ".gz", ".tgz"].includes(extension)) return "archive";
  if ([".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".pdf"].includes(extension)) return "document";
  if ([".c", ".cpp", ".h", ".hpp", ".cs", ".css", ".html", ".java", ".js", ".jsx", ".ts", ".tsx", ".py", ".rb", ".rs", ".go", ".sql"].includes(extension)) return "code";
  return "other";
}

function assertAllowedFile({ buffer, extension, size }) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Arquivo vazio ou inválido.");
  }

  if (size > MAX_FILE_BYTES) {
    throw new Error(`Arquivo excede o limite de ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  }

  if (BLOCKED_EXTENSIONS.has(extension)) {
    throw new Error("Este tipo de arquivo não é permitido por segurança.");
  }

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Extensão de arquivo não permitida.");
  }

  if (extension === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    throw new Error("Arquivo PDF inválido.");
  }

  if (extension === ".png" && buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Arquivo PNG inválido.");
  }

  if ([".jpg", ".jpeg"].includes(extension) && buffer.subarray(0, 3).toString("hex") !== "ffd8ff") {
    throw new Error("Arquivo JPG inválido.");
  }
}

function publicFile(row) {
  return {
    category: row.category,
    createdAt: row.createdAt?.toISOString(),
    description: row.description,
    extension: row.extension,
    id: row.id,
    mimeType: row.mimeType,
    originalName: row.originalName,
    size: row.size,
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export async function listInternalFiles(user) {
  const rows = await getPrisma().internalFile.findMany({
    orderBy: { createdAt: "desc" },
    where: { ownerId: user.id },
  });

  return rows.map(publicFile);
}

export async function saveInternalFile(user, file, { description = "" } = {}) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Envie um arquivo válido.");
  }

  const originalName = cleanFileName(file.name);
  const extension = path.extname(originalName).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const size = Number(file.size || buffer.byteLength);
  assertAllowedFile({ buffer, extension, size });

  const userSegment = userStorageSegment(user);
  const userDirectory = path.join(STORAGE_ROOT, userSegment);
  const storedName = `${crypto.randomUUID()}${extension}`;
  const storageKey = path.posix.join(userSegment, storedName);
  const targetPath = path.join(userDirectory, storedName);
  assertInsideStorage(targetPath);

  await mkdir(userDirectory, { recursive: true });
  await writeFile(targetPath, buffer, { flag: "wx" });

  const row = await getPrisma().internalFile.create({
    data: {
      category: categoryForExtension(extension),
      checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
      description: String(description || "").trim().slice(0, 500),
      extension,
      mimeType: String(file.type || "application/octet-stream").slice(0, 120),
      originalName,
      ownerId: user.id,
      size,
      storageKey,
      storedName,
    },
  });

  return publicFile(row);
}

export async function getInternalFileForDownload(user, fileId) {
  const id = Number.parseInt(String(fileId || ""), 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  const row = await getPrisma().internalFile.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!row) {
    return null;
  }

  const filePath = path.join(STORAGE_ROOT, row.storageKey);
  assertInsideStorage(filePath);

  return {
    data: await readFile(filePath),
    row,
  };
}

export async function deleteInternalFile(user, fileId) {
  const id = Number.parseInt(String(fileId || ""), 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return false;
  }

  const row = await getPrisma().internalFile.findFirst({
    where: { id, ownerId: user.id },
  });
  if (!row) {
    return false;
  }

  const filePath = path.join(STORAGE_ROOT, row.storageKey);
  assertInsideStorage(filePath);

  await getPrisma().internalFile.delete({ where: { id: row.id } });
  await rm(filePath, { force: true });
  return true;
}
