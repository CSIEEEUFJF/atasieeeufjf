import { canManageMembers } from "./auth";
import { getPrisma } from "./db";

const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000;

function sanitizeText(value, maxLength = 600) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
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
    return fileMatch?.[1] ?decodeURIComponent(fileMatch[1]).trim() : "";
  } catch {
    return "";
  }
}

function googleDriveThumbnailUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1600`;
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
    return googleDriveThumbnailUrl(googleDriveFileId);
  }

  try {
    const url = new URL(cleanValue);
    return ["http:", "https:"].includes(url.protocol) ?url.toString() : "";
  } catch {
    return cleanValue.startsWith("/") ?cleanValue : "";
  }
}

function publicHomePhoto(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    imageUrl: row.imageUrl,
    isPublic: row.isPublic,
    photoPositionX: sanitizePercentage(row.photoPositionX),
    photoPositionY: sanitizePercentage(row.photoPositionY),
    photoZoom: sanitizePhotoZoom(row.photoZoom),
    position: row.position,
    title: row.title,
  };
}

function requireHomePhotoManagement(user) {
  if (!canManageMembers(user)) {
    throw new Error("Apenas gestores podem administrar fotos da página inicial.");
  }
}

function sanitizePercentage(value, fallback = 50) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function sanitizePhotoZoom(value, fallback = 100) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(260, Math.max(100, Math.round(numberValue)));
}

function sanitizeHomePhotoPayload(payload = {}) {
  const title = String(payload.title || "").trim().slice(0, 120);
  const imageUrl = sanitizeImageUrl(payload.imageUrl);

  if (!imageUrl) {
    throw new Error("Envie uma imagem, link do Google Drive ou URL válida.");
  }

  if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("A imagem é muito grande. Use uma foto menor.");
  }

  return {
    imageUrl,
    isPublic: payload.isPublic !== false,
    photoPositionX: sanitizePercentage(payload.photoPositionX),
    photoPositionY: sanitizePercentage(payload.photoPositionY),
    photoZoom: sanitizePhotoZoom(payload.photoZoom),
    position: Number.isSafeInteger(Number(payload.position)) ?Number(payload.position) : 0,
    title,
  };
}

function sanitizePartialHomePhotoPayload(payload = {}) {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    data.title = String(payload.title || "").trim().slice(0, 120);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isPublic")) {
    data.isPublic = Boolean(payload.isPublic);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "position")) {
    data.position = Number.isSafeInteger(Number(payload.position)) ?Number(payload.position) : 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoPositionX")) {
    data.photoPositionX = sanitizePercentage(payload.photoPositionX);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoPositionY")) {
    data.photoPositionY = sanitizePercentage(payload.photoPositionY);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoZoom")) {
    data.photoZoom = sanitizePhotoZoom(payload.photoZoom);
  }

  return data;
}

export async function listPublicHomePhotos() {
  const rows = await getPrisma().siteHomePhoto.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
    where: { isPublic: true },
  });

  return rows.map(publicHomePhoto).filter(Boolean);
}

export async function listManagedHomePhotos(currentUser) {
  requireHomePhotoManagement(currentUser);

  const rows = await getPrisma().siteHomePhoto.findMany({
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });

  return rows.map(publicHomePhoto).filter(Boolean);
}

export async function createHomePhoto(currentUser, payload = {}) {
  requireHomePhotoManagement(currentUser);

  const row = await getPrisma().siteHomePhoto.create({
    data: sanitizeHomePhotoPayload(payload),
  });

  return publicHomePhoto(row);
}

export async function deleteHomePhoto(currentUser, photoId) {
  requireHomePhotoManagement(currentUser);

  await getPrisma().siteHomePhoto.delete({
    where: { id: photoId },
  });

  return true;
}

export async function updateHomePhoto(currentUser, photoId, payload = {}) {
  requireHomePhotoManagement(currentUser);

  const row = await getPrisma().siteHomePhoto.update({
    data: sanitizePartialHomePhotoPayload(payload),
    where: { id: photoId },
  });

  return publicHomePhoto(row);
}
