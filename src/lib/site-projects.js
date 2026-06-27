import { normalizarSociedadeChave, SOCIEDADES } from "./ata";
import { canManageMembers } from "./auth";
import { getPrisma } from "./db";

const CHAPTER_KEYS = Object.keys(SOCIEDADES);

function sanitizeText(value, maxLength = 300) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getGoogleDriveFileId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["docs.google.com", "drive.google.com", "drive.usercontent.google.com"].includes(host)) {
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

function sanitizeUrl(value) {
  const cleanValue = sanitizeText(value, 700);
  if (!cleanValue) {
    return "";
  }

  const driveFileId = getGoogleDriveFileId(cleanValue);
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w1000`;
  }

  try {
    const url = new URL(cleanValue);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return cleanValue.startsWith("/") ? cleanValue : "";
  }
}

function normalizeChapter(value) {
  const cleanValue = String(value || "").trim();
  const chapter = normalizarSociedadeChave(cleanValue, "");
  return CHAPTER_KEYS.includes(chapter) ? chapter : "Ramo";
}

function publicSiteProject(row) {
  if (!row) {
    return null;
  }

  return {
    chapter: normalizeChapter(row.chapter),
    id: row.id,
    imageUrl: sanitizeUrl(row.imageUrl),
    isPublic: Boolean(row.isPublic),
    linkUrl: sanitizeUrl(row.linkUrl),
    position: row.position || 0,
    subtitle: row.subtitle || "",
    title: row.title,
  };
}

function requireSiteProjectManagement(user) {
  if (!canManageMembers(user)) {
    throw new Error("Você não tem permissão para gerenciar projetos do site.");
  }
}

function sanitizeSiteProjectPayload(payload = {}) {
  const title = sanitizeText(payload.title, 160);
  if (!title) {
    throw new Error("Informe o título do projeto.");
  }

  return {
    chapter: normalizeChapter(payload.chapter),
    imageUrl: sanitizeUrl(payload.imageUrl),
    isPublic: typeof payload.isPublic === "boolean" ? Boolean(payload.isPublic) : true,
    linkUrl: sanitizeUrl(payload.linkUrl),
    position: Number.isSafeInteger(Number(payload.position)) ? Number(payload.position) : 0,
    subtitle: sanitizeText(payload.subtitle, 260),
    title,
  };
}

function sanitizePartialSiteProjectPayload(payload = {}) {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(payload, "title")) {
    data.title = sanitizeText(payload.title, 160);
    if (!data.title) {
      throw new Error("Informe o título do projeto.");
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, "subtitle")) {
    data.subtitle = sanitizeText(payload.subtitle, 260);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "chapter")) {
    data.chapter = normalizeChapter(payload.chapter);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "imageUrl")) {
    data.imageUrl = sanitizeUrl(payload.imageUrl);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "linkUrl")) {
    data.linkUrl = sanitizeUrl(payload.linkUrl);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "isPublic")) {
    data.isPublic = Boolean(payload.isPublic);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "position")) {
    data.position = Number.isSafeInteger(Number(payload.position)) ? Number(payload.position) : 0;
  }

  if (!Object.keys(data).length) {
    throw new Error("Informe pelo menos um campo para atualizar.");
  }

  return data;
}

export async function listPublicSiteProjects() {
  const rows = await getPrisma().siteProject.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    where: { isPublic: true },
  });

  return rows.map(publicSiteProject).filter(Boolean);
}

export async function listManagedSiteProjects(currentUser) {
  requireSiteProjectManagement(currentUser);

  const rows = await getPrisma().siteProject.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
  });

  return rows.map(publicSiteProject).filter(Boolean);
}

export async function createSiteProject(currentUser, payload = {}) {
  requireSiteProjectManagement(currentUser);

  const row = await getPrisma().siteProject.create({
    data: sanitizeSiteProjectPayload(payload),
  });

  return publicSiteProject(row);
}

export async function updateSiteProject(currentUser, projectId, payload = {}) {
  requireSiteProjectManagement(currentUser);

  const row = await getPrisma().siteProject.update({
    data: sanitizePartialSiteProjectPayload(payload),
    where: { id: projectId },
  });

  return publicSiteProject(row);
}

export async function deleteSiteProject(currentUser, projectId) {
  requireSiteProjectManagement(currentUser);

  await getPrisma().siteProject.delete({
    where: { id: projectId },
  });

  return { ok: true };
}
