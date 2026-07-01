import { normalizarSociedadeChave, SOCIEDADES } from "./ata";
import { canManageMembers } from "./auth";
import { getPrisma } from "./db";
import { fillMissingBiographyTranslation } from "./deepl-translation";

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

  return Math.min(260, Math.max(100, Math.round(numberValue)));
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

function normalizeMatchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sanitizeUserId(value) {
  const userId = Number(value);
  return Number.isSafeInteger(userId) && userId > 0 ? userId : null;
}

async function resolveSiteMemberUserId(data) {
  const explicitUserId = sanitizeUserId(data.userId);
  if (explicitUserId) {
    const exists = await getPrisma().user.findUnique({
      select: { id: true },
      where: { id: explicitUserId },
    });
    return exists?.id || null;
  }

  const cleanName = normalizeMatchText(data.name);
  if (!cleanName) {
    return null;
  }

  const users = await getPrisma().user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
  });
  const memberChapters = new Set(normalizeChapters(data.chapters));

  const scoredUsers = users
    .map((user) => {
      const userName = normalizeMatchText(user.name);
      if (!userName) {
        return null;
      }
      const exactName = userName === cleanName;
      const containsName = userName.includes(cleanName) || cleanName.includes(userName);
      if (!exactName && !containsName) {
        return null;
      }

      const userChapters = new Set(user.chapters.map((chapter) => normalizarSociedadeChave(chapter.chapterKey, "")).filter(Boolean));
      const chapterOverlap = [...memberChapters].some((chapter) => userChapters.has(chapter));
      return {
        id: user.id,
        score: (exactName ? 2 : 1) + (chapterOverlap ? 1 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scoredUsers[0]?.id || null;
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
    userId: row.userId || null,
  };
}

async function fillAndPersistMissingBiography(row) {
  if (!row || (row.bio && row.bioEn) || (!row.bio && !row.bioEn)) {
    return row;
  }

  const translatedData = await fillMissingBiographyTranslation({
    bio: row.bio || "",
    bioEn: row.bioEn || "",
  });

  if (translatedData.bio === row.bio && translatedData.bioEn === row.bioEn) {
    return row;
  }

  try {
    return await getPrisma().siteMember.update({
      data: translatedData,
      where: { id: row.id },
    });
  } catch (error) {
    console.warn("Nao foi possivel salvar a traducao da biografia do membro do site.", error);
    return row;
  }
}

async function publicSiteMembers(rows) {
  const translatedRows = await Promise.all(rows.map(fillAndPersistMissingBiography));
  return translatedRows.map(publicSiteMember).filter(Boolean);
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
    userId: sanitizeUserId(payload.userId),
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

  if (Object.prototype.hasOwnProperty.call(payload, "userId")) {
    data.userId = sanitizeUserId(payload.userId);
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

  return publicSiteMembers(rows);
}

export async function listManagedSiteMembers(currentUser) {
  requireSiteMemberManagement(currentUser);

  const rows = await getPrisma().siteMember.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });

  return publicSiteMembers(rows);
}

export async function createSiteMember(currentUser, payload = {}) {
  requireSiteMemberManagement(currentUser);
  const data = await fillMissingBiographyTranslation(sanitizeSiteMemberPayload(payload));
  data.userId = await resolveSiteMemberUserId(data);

  const row = await getPrisma().siteMember.create({
    data,
  });

  return publicSiteMember(row);
}

export async function updateSiteMember(currentUser, memberId, payload = {}) {
  requireSiteMemberManagement(currentUser);
  const data = await fillMissingBiographyTranslation(sanitizePartialSiteMemberPayload(payload));
  if (
    Object.prototype.hasOwnProperty.call(data, "userId") ||
    Object.prototype.hasOwnProperty.call(data, "name") ||
    Object.prototype.hasOwnProperty.call(data, "chapters")
  ) {
    const current = await getPrisma().siteMember.findUnique({ where: { id: memberId } });
    data.userId = await resolveSiteMemberUserId({ ...current, ...data });
  }

  const row = await getPrisma().siteMember.update({
    data,
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

export async function syncSiteMembersToUsers(currentUser) {
  requireSiteMemberManagement(currentUser);
  const members = await getPrisma().siteMember.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
  let linked = 0;

  for (const member of members) {
    const userId = await resolveSiteMemberUserId(member);
    if (userId && userId !== member.userId) {
      await getPrisma().siteMember.update({
        data: { userId },
        where: { id: member.id },
      });
      linked += 1;
    }
  }

  return { linked, total: members.length };
}
