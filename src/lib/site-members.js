import { normalizarSociedadeChave, SOCIEDADES } from "./ata";
import { canManageMembers } from "./auth";
import { getPrisma } from "./db";

const CHAPTER_KEYS = Object.keys(SOCIEDADES);
const MEMBER_ROLE_OPTIONS = [
  "Membro",
  "Presidente",
  "Vice-Presidente",
  "Tesoureiro",
  "Webmaster",
  "Secretário",
  "Conselheiro",
];

const MEMBER_ROLE_ALIASES = {
  Secretario: "Secretário",
  "Vice Presidente": "Vice-Presidente",
  "Vice-presidente": "Vice-Presidente",
  Membros: "Membro",
};

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
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1000`;
}

function sanitizeUrl(value) {
  const cleanValue = sanitizeText(value, 500);
  if (!cleanValue) {
    return "";
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

  return Math.min(200, Math.max(100, Math.round(numberValue)));
}

function normalizeRole(role) {
  const cleanRole = sanitizeText(role, 80);
  const canonical = MEMBER_ROLE_ALIASES[cleanRole] || cleanRole;
  return MEMBER_ROLE_OPTIONS.includes(canonical) ?canonical : "Membro";
}

function normalizeChapters(chapters) {
  const requested = Array.isArray(chapters) ?chapters : [];
  const normalized = requested
    .map((chapter) => normalizarSociedadeChave(chapter, ""))
    .filter((chapter) => CHAPTER_KEYS.includes(chapter));

  return [...new Set(normalized)];
}

function publicSiteMember(row) {
  if (!row) {
    return null;
  }

  return {
    bio: row.bio || "",
    bioEn: row.bioEn || "",
    chapters: normalizeChapters(row.chapters),
    id: row.id,
    isPublic: Boolean(row.isPublic),
    name: row.name,
    photoUrl: sanitizeUrl(row.photoUrl),
    photoPositionX: sanitizePercentage(row.photoPositionX),
    photoPositionY: sanitizePercentage(row.photoPositionY),
    photoZoom: sanitizePhotoZoom(row.photoZoom),
    position: row.position || 0,
    role: normalizeRole(row.role),
  };
}

function requireSiteMemberManagement(user) {
  if (!canManageMembers(user)) {
    throw new Error("Você não tem permissão para gerenciar membros do site.");
  }
}

function sanitizeSiteMemberPayload(payload = {}) {
  const cleanName = sanitizeText(payload.name, 160);
  if (!cleanName) {
    throw new Error("Informe o nome do membro.");
  }

  return {
    bio: sanitizeText(payload.bio, 600),
    bioEn: sanitizeText(payload.bioEn, 600),
    chapters: normalizeChapters(payload.chapters),
    isPublic: typeof payload.isPublic === "boolean" ?Boolean(payload.isPublic) : true,
    name: cleanName,
    photoUrl: sanitizeUrl(payload.photoUrl),
    photoPositionX: sanitizePercentage(payload.photoPositionX),
    photoPositionY: sanitizePercentage(payload.photoPositionY),
    photoZoom: sanitizePhotoZoom(payload.photoZoom),
    position: Number.isSafeInteger(Number(payload.position)) ?Number(payload.position) : 0,
    role: normalizeRole(payload.role || payload.cargo),
  };
}

function sanitizePartialSiteMemberPayload(payload = {}) {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(payload, "name")) {
    data.name = sanitizeText(payload.name, 160);
    if (!data.name) {
      throw new Error("Informe o nome do membro.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "bio")) {
    data.bio = sanitizeText(payload.bio, 600);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "bioEn")) {
    data.bioEn = sanitizeText(payload.bioEn, 600);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "chapters")) {
    data.chapters = normalizeChapters(payload.chapters);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isPublic")) {
    data.isPublic = Boolean(payload.isPublic);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "photoUrl")) {
    data.photoUrl = sanitizeUrl(payload.photoUrl);
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

  if (Object.prototype.hasOwnProperty.call(payload, "position")) {
    data.position = Number.isSafeInteger(Number(payload.position)) ?Number(payload.position) : 0;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "role") || Object.prototype.hasOwnProperty.call(payload, "cargo")) {
    data.role = normalizeRole(payload.role || payload.cargo);
  }

  if (!Object.keys(data).length) {
    throw new Error("Informe pelo menos um campo para atualizar.");
  }

  return data;
}

export async function listPublicSiteMembers() {
  const rows = await getPrisma().siteMember.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    where: { isPublic: true },
  });

  return rows.map(publicSiteMember).filter(Boolean);
}

export async function listManagedSiteMembers(currentUser) {
  requireSiteMemberManagement(currentUser);

  const rows = await getPrisma().siteMember.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  return rows.map(publicSiteMember).filter(Boolean);
}

export async function createSiteMember(currentUser, payload = {}) {
  requireSiteMemberManagement(currentUser);

  const row = await getPrisma().siteMember.create({
    data: sanitizeSiteMemberPayload(payload),
  });

  return publicSiteMember(row);
}

export async function updateSiteMember(currentUser, memberId, payload = {}) {
  requireSiteMemberManagement(currentUser);

  const row = await getPrisma().siteMember.update({
    data: sanitizePartialSiteMemberPayload(payload),
    where: { id: memberId },
  });

  return publicSiteMember(row);
}

export async function deleteSiteMember(currentUser, memberId) {
  requireSiteMemberManagement(currentUser);

  await getPrisma().siteMember.delete({
    where: { id: memberId },
  });

  return { ok: true };
}
