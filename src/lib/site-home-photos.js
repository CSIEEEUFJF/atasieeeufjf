import { canManageMembers } from "./auth";
import { getPrisma } from "./db";

const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000;

function publicHomePhoto(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    imageUrl: row.imageUrl,
    isPublic: row.isPublic,
    position: row.position,
    title: row.title,
  };
}

function requireHomePhotoManagement(user) {
  if (!canManageMembers(user)) {
    throw new Error("Apenas gestores podem administrar fotos da página inicial.");
  }
}

function sanitizeHomePhotoPayload(payload = {}) {
  const title = String(payload.title || "").trim().slice(0, 120);
  const imageUrl = String(payload.imageUrl || "").trim();

  if (!imageUrl) {
    throw new Error("Envie uma imagem para o slideshow.");
  }

  if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(imageUrl) && !imageUrl.startsWith("/")) {
    throw new Error("Use uma imagem válida em JPG, PNG ou WebP.");
  }

  if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error("A imagem é muito grande. Use uma foto menor.");
  }

  return {
    imageUrl,
    isPublic: payload.isPublic !== false,
    position: Number.isSafeInteger(Number(payload.position)) ?Number(payload.position) : 0,
    title,
  };
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
