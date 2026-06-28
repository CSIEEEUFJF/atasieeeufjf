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
const STORAGE_MODE = (process.env.INTERNAL_FILES_STORAGE_MODE || "remote").toLowerCase();
const REMOTE_STORAGE_URL = String(process.env.INTERNAL_STORAGE_RECEIVER_URL || "").replace(/\/+$/, "");
const REMOTE_STORAGE_TOKEN = process.env.INTERNAL_STORAGE_RECEIVER_TOKEN || "";
const REMOTE_TIMEOUT_MS = Number(process.env.INTERNAL_STORAGE_RECEIVER_TIMEOUT_MS || 5000);

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

export class StorageUnavailableError extends Error {
  constructor(message = "Serviço de dados indisponível.") {
    super(message);
    this.name = "StorageUnavailableError";
  }
}

export class StorageDisabledError extends Error {
  constructor(message = "Armazenamento desabilitado por enquanto.") {
    super(message);
    this.name = "StorageDisabledError";
  }
}

function assertStorageEnabled() {
  if (STORAGE_MODE === "disabled") {
    throw new StorageDisabledError();
  }
}

function useRemoteStorage() {
  return STORAGE_MODE !== "local";
}

function requireRemoteConfig() {
  if (!REMOTE_STORAGE_URL || !REMOTE_STORAGE_TOKEN) {
    throw new StorageUnavailableError("Serviço de dados não configurado.");
  }
}

function remoteHeaders(extraHeaders = {}) {
  return {
    Authorization: `Bearer ${REMOTE_STORAGE_TOKEN}`,
    ...extraHeaders,
  };
}

function timeoutSignal() {
  return AbortSignal.timeout(Math.max(1000, REMOTE_TIMEOUT_MS));
}

async function assertRemoteAvailable() {
  requireRemoteConfig();

  try {
    const response = await fetch(`${REMOTE_STORAGE_URL}/health`, {
      cache: "no-store",
      headers: remoteHeaders(),
      signal: timeoutSignal(),
    });
    if (!response.ok) {
      throw new Error(`Healthcheck retornou ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      throw error;
    }
    throw new StorageUnavailableError("Serviço de dados offline.");
  }
}

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

function publicFileFromRemote(remoteFile, row) {
  return publicFile({
    category: categoryForExtension(row.extension),
    createdAt: row.createdAt,
    description: row.description,
    extension: row.extension,
    id: row.id,
    mimeType: remoteFile.mimeType || row.mimeType,
    originalName: remoteFile.originalName || row.originalName,
    size: Number(remoteFile.size || row.size || 0),
    updatedAt: row.updatedAt,
  });
}

export async function listInternalFiles(user) {
  assertStorageEnabled();

  if (useRemoteStorage()) {
    await assertRemoteAvailable();
  }

  const rows = await getPrisma().internalFile.findMany({
    orderBy: { createdAt: "desc" },
    where: { ownerId: user.id },
  });

  return rows.map(publicFile);
}

export async function saveInternalFile(user, file, { description = "" } = {}) {
  assertStorageEnabled();

  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Envie um arquivo válido.");
  }

  const originalName = cleanFileName(file.name);
  const extension = path.extname(originalName).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  const size = Number(file.size || buffer.byteLength);
  assertAllowedFile({ buffer, extension, size });

  if (useRemoteStorage()) {
    await assertRemoteAvailable();

    const formData = new FormData();
    formData.append("files", new Blob([buffer], { type: file.type || "application/octet-stream" }), originalName);

    let payload;
    try {
      const response = await fetch(`${REMOTE_STORAGE_URL}/upload?ownerId=${encodeURIComponent(user.id)}`, {
        body: formData,
        headers: remoteHeaders(),
        method: "POST",
        signal: timeoutSignal(),
      });
      payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || "Upload remoto falhou.");
      }
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        throw error;
      }
      throw new StorageUnavailableError(error.message || "Serviço de dados offline.");
    }

    const remoteFile = Array.isArray(payload.files) ?payload.files[0] : null;
    if (!remoteFile?.storedName || !remoteFile?.storageKey) {
      throw new StorageUnavailableError("Resposta inválida do serviço de dados.");
    }

    const row = await getPrisma().internalFile.create({
      data: {
        category: categoryForExtension(extension),
        checksum: String(remoteFile.checksum || crypto.createHash("sha256").update(buffer).digest("hex")),
        description: String(description || "").trim().slice(0, 500),
        extension,
        mimeType: String(remoteFile.mimeType || file.type || "application/octet-stream").slice(0, 120),
        originalName,
        ownerId: user.id,
        size: Number(remoteFile.size || size),
        storageKey: String(remoteFile.storageKey),
        storedName: String(remoteFile.storedName),
      },
    });

    return publicFileFromRemote(remoteFile, row);
  }

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
  assertStorageEnabled();

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

  if (useRemoteStorage()) {
    await assertRemoteAvailable();
    try {
      const response = await fetch(
        `${REMOTE_STORAGE_URL}/download/${encodeURIComponent(user.id)}/${encodeURIComponent(row.storedName)}`,
        {
          cache: "no-store",
          headers: remoteHeaders(),
          signal: timeoutSignal(),
        },
      );
      if (!response.ok) {
        return null;
      }
      return {
        data: Buffer.from(await response.arrayBuffer()),
        row,
      };
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        throw error;
      }
      throw new StorageUnavailableError("Serviço de dados offline.");
    }
  }

  const filePath = path.join(STORAGE_ROOT, row.storageKey);
  assertInsideStorage(filePath);

  return {
    data: await readFile(filePath),
    row,
  };
}

export async function deleteInternalFile(user, fileId) {
  assertStorageEnabled();

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

  if (useRemoteStorage()) {
    await assertRemoteAvailable();
    try {
      const response = await fetch(
        `${REMOTE_STORAGE_URL}/files/${encodeURIComponent(user.id)}/${encodeURIComponent(row.storedName)}`,
        {
          headers: remoteHeaders(),
          method: "DELETE",
          signal: timeoutSignal(),
        },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error("Remoção remota falhou.");
      }
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        throw error;
      }
      throw new StorageUnavailableError("Serviço de dados offline.");
    }

    await getPrisma().internalFile.delete({ where: { id: row.id } });
    return true;
  }

  const filePath = path.join(STORAGE_ROOT, row.storageKey);
  assertInsideStorage(filePath);

  await getPrisma().internalFile.delete({ where: { id: row.id } });
  await rm(filePath, { force: true });
  return true;
}
