import { cookies } from "next/headers";
import crypto from "node:crypto";

import { SOCIEDADES, SOCIEDADE_LABELS } from "./ata";
import { getPrisma, nowDate } from "./db";

export const SESSION_COOKIE = "atas_ieee_session";

const SESSION_DAYS = 14;
const PASSWORD_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 6;
const CHAPTER_KEYS = Object.keys(SOCIEDADES);

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

function internalEmailForUsername(username) {
  return `${username}@local.atas-ieee`;
}

function chapterKeyFromRelation(chapter) {
  return typeof chapter === "string" ? chapter : chapter?.chapterKey;
}

function publicUser(row) {
  if (!row) {
    return null;
  }

  return {
    chapters: Array.isArray(row.chapters)
      ? row.chapters.map(chapterKeyFromRelation).filter(Boolean)
      : [],
    id: row.id,
    isAdmin: Boolean(row.isAdmin),
    name: row.name,
    username: row.username,
  };
}

function normalizeChapterKeys(chapters, { allowAll = false } = {}) {
  if (allowAll) {
    return CHAPTER_KEYS;
  }

  const requested = Array.isArray(chapters) ? chapters : [];
  const valid = new Set(CHAPTER_KEYS);
  return [...new Set(requested.map((item) => String(item || "").trim()).filter((item) => valid.has(item)))];
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  const passwordHash = crypto
    .scryptSync(password, salt, PASSWORD_KEY_LENGTH)
    .toString("base64");

  return {
    passwordHash,
    passwordSalt: salt,
  };
}

function verifyPassword(password, salt, expectedHash) {
  const { passwordHash } = hashPassword(password, salt);
  const actual = Buffer.from(passwordHash, "base64");
  const expected = Buffer.from(expectedHash, "base64");

  if (actual.byteLength !== expected.byteLength) {
    return false;
  }

  return crypto.timingSafeEqual(actual, expected);
}

export function isUniqueConstraintError(error) {
  return error?.code === "P2002";
}

export async function hasUsers() {
  const count = await getPrisma().user.count();
  return count > 0;
}

export function getChapterOptions() {
  return CHAPTER_KEYS.map((key) => ({
    key,
    label: SOCIEDADE_LABELS[key] || key,
  }));
}

export async function getUserChapters(userId) {
  const rows = await getPrisma().userChapter.findMany({
    orderBy: { chapterKey: "asc" },
    select: { chapterKey: true },
    where: { userId },
  });

  return rows.map((row) => row.chapterKey);
}

export function isChapterMember(user, chapterKey) {
  return Boolean(user?.chapters?.includes(chapterKey));
}

export async function createUser({ chapters, email, name, password, username }, options = {}) {
  const cleanUsername = normalizeUsername(username || email);
  const cleanName = String(name || "").trim();
  const cleanPassword = String(password || "");
  const isAdmin = Boolean(options.isAdmin);
  const userChapters = normalizeChapterKeys(chapters, { allowAll: isAdmin });

  if (!cleanName) {
    throw new Error("Informe o nome do usuario.");
  }

  if (!cleanUsername || !/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
    throw new Error("Informe um nome de usuario com 3 a 40 caracteres, usando letras, numeros, ponto, hifen ou underline.");
  }

  if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (!userChapters.length) {
    throw new Error("Associe o usuario a pelo menos um capitulo.");
  }

  const { passwordHash, passwordSalt } = hashPassword(cleanPassword);
  const user = await getPrisma().user.create({
    data: {
      chapters: {
        create: userChapters.map((chapterKey) => ({ chapterKey })),
      },
      email: internalEmailForUsername(cleanUsername),
      isAdmin,
      name: cleanName,
      passwordHash,
      passwordSalt,
      username: cleanUsername,
    },
    include: { chapters: true },
  });

  return publicUser(user);
}

export async function verifyCredentials(username, password) {
  const cleanUsername = normalizeUsername(username);
  const row = await getPrisma().user.findUnique({
    include: { chapters: true },
    where: { username: cleanUsername },
  });

  if (!row || !verifyPassword(String(password || ""), row.passwordSalt, row.passwordHash)) {
    return null;
  }

  return publicUser(row);
}

export async function changeOwnPassword(userId, currentPassword, newPassword) {
  const cleanPassword = String(newPassword || "");
  if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  const user = await getPrisma().user.findUnique({
    where: { id: userId },
  });

  if (!user || !verifyPassword(String(currentPassword || ""), user.passwordSalt, user.passwordHash)) {
    throw new Error("Senha atual incorreta.");
  }

  const { passwordHash, passwordSalt } = hashPassword(cleanPassword);
  await getPrisma().user.update({
    data: {
      passwordHash,
      passwordSalt,
    },
    where: { id: userId },
  });
}

export async function listUsers() {
  const users = await getPrisma().user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
  });

  return users.map(publicUser);
}

export async function updateUserAdminStatus(currentUser, targetUserId, isAdmin) {
  if (currentUser.id === targetUserId) {
    throw new Error("Voce nao pode alterar sua propria permissao de administrador.");
  }

  const targetUser = await getPrisma().user.findUnique({
    include: { chapters: true },
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return null;
  }

  const shouldBeAdmin = Boolean(isAdmin);
  const currentChapters = new Set(targetUser.chapters.map((chapter) => chapter.chapterKey));
  const missingAdminChapters = shouldBeAdmin
    ? CHAPTER_KEYS.filter((chapterKey) => !currentChapters.has(chapterKey))
    : [];

  const updatedUser = await getPrisma().user.update({
    data: {
      chapters: missingAdminChapters.length
        ? {
            create: missingAdminChapters.map((chapterKey) => ({ chapterKey })),
          }
        : undefined,
      isAdmin: shouldBeAdmin,
    },
    include: { chapters: true },
    where: { id: targetUserId },
  });

  return publicUser(updatedUser);
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const createdAt = nowDate();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await getPrisma().session.create({
    data: {
      createdAt,
      expiresAt,
      lastSeenAt: createdAt,
      tokenHash,
      userId,
    },
  });

  return { expiresAt: expiresAt.toISOString(), token };
}

export async function destroySession(token) {
  if (!token) {
    return;
  }

  await getPrisma().session.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}

export async function deleteExpiredSessions() {
  await getPrisma().session.deleteMany({
    where: { expiresAt: { lte: nowDate() } },
  });
}

export async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value || "";
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  await deleteExpiredSessions();

  const tokenHash = hashToken(token);
  const session = await getPrisma().session.findFirst({
    include: {
      user: {
        include: { chapters: true },
      },
    },
    where: {
      expiresAt: { gt: nowDate() },
      tokenHash,
    },
  });

  if (!session) {
    return null;
  }

  await getPrisma().session.update({
    data: { lastSeenAt: nowDate() },
    where: { tokenHash },
  });

  return publicUser(session.user);
}

export function setSessionCookie(response, token, expiresAt) {
  response.cookies.set({
    expires: new Date(expiresAt),
    httpOnly: true,
    name: SESSION_COOKIE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: token,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    name: SESSION_COOKIE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: "",
  });
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const url = new URL(request.url);
  return origin === `${url.protocol}//${url.host}`;
}
