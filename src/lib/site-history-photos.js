import { canManageMembers } from "./auth";
import { getPrisma } from "./db";

const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000;
const MAX_DRIVE_IMPORT_PHOTOS = 500;

function sanitizeText(value, maxLength = 600) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function getGoogleDriveFileId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isGoogleDriveUrl = [
      "docs.google.com",
      "drive.google.com",
      "drive.usercontent.google.com",
    ].includes(host);

    if (!isGoogleDriveUrl) {
      return "";
    }

    const queryId = url.searchParams.get("id")?.trim();
    if (queryId) {
      return queryId;
    }

    const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
    return fileMatch?.[1] ? decodeURIComponent(fileMatch[1]).trim() : "";
  } catch {
    return "";
  }
}

function getGoogleDriveFolderId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isGoogleDriveUrl = ["drive.google.com", "drive.usercontent.google.com"].includes(host);

    if (!isGoogleDriveUrl) {
      return "";
    }

    const queryId = url.searchParams.get("id")?.trim();
    if (queryId) {
      return queryId;
    }

    const folderMatch = url.pathname.match(/\/folders\/([^/]+)/);
    return folderMatch?.[1] ? decodeURIComponent(folderMatch[1]).trim() : "";
  } catch {
    return "";
  }
}

function sanitizeImageUrl(value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) {
    return "";
  }

  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(cleanValue)) {
    return cleanValue;
  }

  const googleDriveFileId = getGoogleDriveFileId(cleanValue);
  if (googleDriveFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(googleDriveFileId)}&sz=w1600`;
  }

  try {
    const url = new URL(cleanValue);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return cleanValue.startsWith("/") ? cleanValue : "";
  }
}

function thumbnailUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
}

function sanitizeYear(value) {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) {
    return 0;
  }

  return year;
}

function extractYearFromText(value) {
  const match = String(value || "").match(/\b(19\d{2}|20\d{2}|2100)\b/);
  return sanitizeYear(match?.[1]);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\\"/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeDriveFileTitle(value, fallback) {
  const decodedValue = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\.(?:jpe?g|png|webp)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return sanitizeText(decodedValue || fallback, 160);
}

function inferFileNameNearId(html, fileId) {
  const index = html.indexOf(fileId);
  if (index < 0) {
    return "";
  }

  const snippet = decodeHtmlEntities(html.slice(Math.max(0, index - 900), index + 1400));
  const candidates = [
    ...snippet.matchAll(/["']([^"']{2,180}\.(?:jpe?g|png|webp))["']/gi),
    ...snippet.matchAll(/(?:aria-label|title|data-tooltip)=["']([^"']{2,180})["']/gi),
  ]
    .map((match) => normalizeDriveFileTitle(match[1], ""))
    .filter((candidate) => candidate && !candidate.includes("drive.google") && !candidate.includes("thumbnail"));

  return candidates[0] || "";
}

async function fetchTextWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 IEEE-UFJF-HistoryPhotoImport/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function listGoogleDriveFolderPhotoCandidates(folderUrl) {
  const folderId = getGoogleDriveFolderId(folderUrl);
  if (!folderId) {
    throw new Error("Informe um link valido de pasta do Google Drive.");
  }

  const urls = [
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`,
    `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`,
  ];
  const candidatesById = new Map();

  for (const url of urls) {
    const html = await fetchTextWithTimeout(url);
    if (!html) {
      continue;
    }

    const matches = [
      ...html.matchAll(/\/file\/d\/([a-zA-Z0-9_-]{20,})/g),
      ...html.matchAll(/["'](?:id|docid)["']\s*[:,]\s*["']([a-zA-Z0-9_-]{20,})["']/g),
      ...html.matchAll(/data-id=["']([a-zA-Z0-9_-]{20,})["']/g),
      ...html.matchAll(/\["([a-zA-Z0-9_-]{20,})","([^"]{2,220}\.(?:jpe?g|png|webp))"/gi),
    ];

    for (const match of matches) {
      const fileId = match[1];
      if (!fileId || fileId === folderId || candidatesById.has(fileId)) {
        continue;
      }

      const rawName = match[2] || inferFileNameNearId(html, fileId);
      const title = normalizeDriveFileTitle(rawName, `Foto historica ${candidatesById.size + 1}`);

      candidatesById.set(fileId, {
        imageUrl: thumbnailUrl(fileId),
        title,
        year: extractYearFromText(title),
      });

      if (candidatesById.size >= MAX_DRIVE_IMPORT_PHOTOS) {
        break;
      }
    }

    if (candidatesById.size) {
      break;
    }
  }

  return [...candidatesById.values()];
}

function publicHistoryPhoto(row) {
  if (!row) {
    return null;
  }

  return {
    description: row.description || "",
    id: row.id,
    imageUrl: sanitizeImageUrl(row.imageUrl),
    isPublic: Boolean(row.isPublic),
    photoPositionX: clampNumber(row.photoPositionX, 0, 100, 50),
    photoPositionY: clampNumber(row.photoPositionY, 0, 100, 50),
    photoZoom: clampNumber(row.photoZoom, 100, 260, 100),
    position: row.position || 0,
    title: row.title,
    year: row.year || 0,
  };
}

function requireHistoryPhotoManagement(user) {
  if (!canManageMembers(user)) {
    throw new Error("Apenas gestores podem administrar fotos historicas do site.");
  }
}

function sanitizeHistoryPhotoPayload(payload = {}) {
  const title = sanitizeText(payload.title, 160);
  const imageUrl = sanitizeImageUrl(payload.imageUrl);

  if (!title) {
    throw new Error("Informe o titulo da foto historica.");
  }

  if (!imageUrl) {
    throw new Error("Envie uma imagem, link do Google Drive ou URL valida.");
  }

  if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("A imagem e muito grande. Use uma foto menor.");
  }

  return {
    description: sanitizeText(payload.description, 900),
    imageUrl,
    isPublic: typeof payload.isPublic === "boolean" ? Boolean(payload.isPublic) : true,
    photoPositionX: clampNumber(payload.photoPositionX, 0, 100, 50),
    photoPositionY: clampNumber(payload.photoPositionY, 0, 100, 50),
    photoZoom: clampNumber(payload.photoZoom, 100, 260, 100),
    position: Number.isSafeInteger(Number(payload.position)) ? Number(payload.position) : 0,
    title,
    year: sanitizeYear(payload.year),
  };
}

function sanitizePartialHistoryPhotoPayload(payload = {}) {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    data.title = sanitizeText(payload.title, 160);
    if (!data.title) {
      throw new Error("Informe o titulo da foto historica.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    data.description = sanitizeText(payload.description, 900);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "year")) {
    data.year = sanitizeYear(payload.year);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "imageUrl")) {
    data.imageUrl = sanitizeImageUrl(payload.imageUrl);
    if (!data.imageUrl) {
      throw new Error("Envie uma imagem, link do Google Drive ou URL valida.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isPublic")) {
    data.isPublic = Boolean(payload.isPublic);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "position")) {
    data.position = Number.isSafeInteger(Number(payload.position)) ? Number(payload.position) : 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoPositionX")) {
    data.photoPositionX = clampNumber(payload.photoPositionX, 0, 100, 50);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoPositionY")) {
    data.photoPositionY = clampNumber(payload.photoPositionY, 0, 100, 50);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoZoom")) {
    data.photoZoom = clampNumber(payload.photoZoom, 100, 260, 100);
  }

  if (!Object.keys(data).length) {
    throw new Error("Informe pelo menos um campo para atualizar.");
  }

  return data;
}

export async function listPublicHistoryPhotos() {
  const rows = await getPrisma().siteHistoryPhoto.findMany({
    orderBy: [{ year: "asc" }, { position: "asc" }, { id: "asc" }],
    where: { isPublic: true },
  });

  return rows.map(publicHistoryPhoto).filter(Boolean);
}

export async function listManagedHistoryPhotos(currentUser) {
  requireHistoryPhotoManagement(currentUser);

  const rows = await getPrisma().siteHistoryPhoto.findMany({
    orderBy: [{ year: "asc" }, { position: "asc" }, { id: "asc" }],
  });

  return rows.map(publicHistoryPhoto).filter(Boolean);
}

export async function createHistoryPhoto(currentUser, payload = {}) {
  requireHistoryPhotoManagement(currentUser);

  const row = await getPrisma().siteHistoryPhoto.create({
    data: sanitizeHistoryPhotoPayload(payload),
  });

  return publicHistoryPhoto(row);
}

export async function importHistoryPhotosFromDriveFolder(currentUser, payload = {}) {
  requireHistoryPhotoManagement(currentUser);

  const folderUrl = sanitizeText(payload.driveFolderUrl, 700);
  const candidates = await listGoogleDriveFolderPhotoCandidates(folderUrl);

  if (!candidates.length) {
    throw new Error("Nenhuma imagem publica foi encontrada nesta pasta.");
  }

  const prisma = getPrisma();
  const existingRows = await prisma.siteHistoryPhoto.findMany({
    select: { imageUrl: true, position: true },
  });
  const existingUrls = new Set(existingRows.map((row) => sanitizeImageUrl(row.imageUrl)).filter(Boolean));
  let nextPosition = existingRows.reduce(
    (maxPosition, row) => Math.max(maxPosition, Number(row.position) || 0),
    -1,
  ) + 1;
  const createdPhotos = [];

  for (const candidate of candidates) {
    if (existingUrls.has(candidate.imageUrl)) {
      continue;
    }

    const row = await prisma.siteHistoryPhoto.create({
      data: {
        description: "",
        imageUrl: candidate.imageUrl,
        isPublic: true,
        photoPositionX: 50,
        photoPositionY: 50,
        photoZoom: 100,
        position: nextPosition,
        title: candidate.title,
        year: candidate.year,
      },
    });

    existingUrls.add(candidate.imageUrl);
    createdPhotos.push(publicHistoryPhoto(row));
    nextPosition += 1;
  }

  return {
    created: createdPhotos,
    found: candidates.length,
    skipped: candidates.length - createdPhotos.length,
  };
}

export async function updateHistoryPhoto(currentUser, photoId, payload = {}) {
  requireHistoryPhotoManagement(currentUser);

  const row = await getPrisma().siteHistoryPhoto.update({
    data: sanitizePartialHistoryPhotoPayload(payload),
    where: { id: photoId },
  });

  return publicHistoryPhoto(row);
}

export async function deleteHistoryPhoto(currentUser, photoId) {
  requireHistoryPhotoManagement(currentUser);

  await getPrisma().siteHistoryPhoto.delete({
    where: { id: photoId },
  });

  return { ok: true };
}
