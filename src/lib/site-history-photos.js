import { canManageMembers } from "./auth";
import { getPrisma } from "./db";

const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000;

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

function sanitizeYear(value) {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year) || year < 1900 || year > 2100) {
    return 0;
  }

  return year;
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
