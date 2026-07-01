import { cookies } from "next/headers";
import crypto from "node:crypto";

import {
  expandirSociedadesParaBusca,
  normalizarSociedadeChave,
  SOCIEDADES,
  SOCIEDADE_LABELS,
} from "./ata";
import { getPrisma, nowDate } from "./db";
import { notifyUserWelcome } from "./email-notifications";
import {
  syncFirebaseAuthUser,
} from "./firebase-auth-admin";
import {
  syncInternalUserToFirebase,
  syncInternalUsersToFirebase,
} from "./firebase-sync";

export const SESSION_COOKIE = "atas_ieee_session";

const SESSION_DAYS = 14;
const MAX_ACTIVE_SESSIONS_PER_USER = 5;
const PASSWORD_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 10;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;
const RATE_LIMITS = {
  login: { limit: 12, windowMs: 10 * 60 * 1000 },
  password: { limit: 8, windowMs: 10 * 60 * 1000 },
  setup: { limit: 5, windowMs: 60 * 60 * 1000 },
};
const CHAPTER_KEYS = Object.keys(SOCIEDADES);
export const MEMBER_ROLE_OPTIONS = [
  "Membro",
  "Presidente",
  "Vice-Presidente",
  "Tesoureiro",
  "Webmaster",
  "Secretário",
  "Conselheiro",
];

const MEMBER_ROLE_ALIASES = {
  "Secretario": "Secretário",
  "Vice Presidente": "Vice-Presidente",
  "Vice-presidente": "Vice-Presidente",
  "Membros": "Membro",
};

const globalForSecurity = globalThis;

if (!globalForSecurity.atasAuthRateLimits) {
  globalForSecurity.atasAuthRateLimits = new Map();
}

export class AuthSecurityError extends Error {
  constructor(message, status = 400, retryAfterSeconds = 0) {
    super(message);
    this.name = "AuthSecurityError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

function getRequestOrigin(request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const host = forwardedHost || url.host;
  const protocol = forwardedProto || url.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "local";
}

export function checkAuthRateLimit(request, scope) {
  const config = RATE_LIMITS[scope] || RATE_LIMITS.login;
  const now = Date.now();
  const key = `${scope}:${getClientIp(request)}`;
  const attempts = (globalForSecurity.atasAuthRateLimits.get(key) || [])
    .filter((timestamp) => now - timestamp < config.windowMs);

  if (attempts.length >= config.limit) {
    const retryAfterMs = config.windowMs - (now - attempts[0]);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  attempts.push(now);
  globalForSecurity.atasAuthRateLimits.set(key, attempts);
  return { limited: false, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds) {
  return {
    body: { detail: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
    init: {
      headers: noStoreHeaders({ "Retry-After": String(retryAfterSeconds) }),
      status: 429,
    },
  };
}

export function noStoreHeaders(headers = {}) {
  return {
    "Cache-Control": "no-store",
    ...headers,
  };
}

function internalEmailForUsername(username) {
  return `${username}@local.atas-ieee`;
}

function normalizeEmail(value, fallback = "") {
  const cleanValue = String(value || "").trim().toLowerCase();
  if (!cleanValue) {
    return fallback;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue) || cleanValue.length > 254) {
    throw new Error("Informe um e-mail válido.");
  }

  return cleanValue;
}

function chapterKeyFromRelation(chapter) {
  return normalizarSociedadeChave(
    typeof chapter === "string" ?chapter : chapter?.chapterKey,
    "",
  );
}

function sanitizeCargo(value) {
  return String(value || "").trim().slice(0, 180);
}

function normalizeMemberRole(value, fallback = "") {
  const cleanValue = sanitizeCargo(value);
  if (!cleanValue) {
    return fallback;
  }

  const canonical = MEMBER_ROLE_ALIASES[cleanValue] || cleanValue;
  return MEMBER_ROLE_OPTIONS.includes(canonical) ?canonical : fallback;
}

function normalizeChapterRoles(chapterRoles) {
  if (!chapterRoles || typeof chapterRoles !== "object" || Array.isArray(chapterRoles)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(chapterRoles)
      .map(([chapterKey, cargo]) => [
        normalizarSociedadeChave(chapterKey, ""),
        normalizeMemberRole(cargo, ""),
      ])
      .filter(([chapterKey, cargo]) => CHAPTER_KEYS.includes(chapterKey) && cargo),
  );
}

function rolesForChapters(chapterRoles, chapterKeys, fallbackCargo = "") {
  const roles = normalizeChapterRoles(chapterRoles);
  const fallback = normalizeMemberRole(fallbackCargo, "");

  return Object.fromEntries(
    chapterKeys
      .map((chapterKey) => [chapterKey, roles[chapterKey] || fallback])
      .filter(([, cargo]) => cargo),
  );
}

function roleForChapter(user, chapterKey) {
  const roles = normalizeChapterRoles(user?.chapterRoles);
  if (Object.prototype.hasOwnProperty.call(roles, chapterKey)) {
    return roles[chapterKey] || "Membro";
  }

  if (Object.keys(roles).length) {
    return "Membro";
  }

  return normalizeMemberRole(user?.cargo, "Membro");
}

export function getUserRoleForChapter(user, chapterKey) {
  return roleForChapter(user, chapterKey);
}

export function isRamoBoardMember(user) {
  if (!user) {
    return false;
  }

  return Boolean(user.isAdmin) || roleForChapter(user, "Ramo") !== "Membro";
}

export function getManageableChapterKeys(user) {
  if (!user) {
    return [];
  }

  if (user.isAdmin) {
    return CHAPTER_KEYS;
  }

  const userChapters = Array.isArray(user.chapters)
    ?user.chapters.map((chapter) => normalizarSociedadeChave(chapter, "")).filter(Boolean)
    : [];

  return userChapters.filter((chapterKey) => roleForChapter(user, chapterKey) !== "Membro");
}

export function canManageMembers(user) {
  return getManageableChapterKeys(user).length > 0;
}

function publicUser(row) {
  if (!row) {
    return null;
  }

  const cargo = normalizeMemberRole(row.cargo, row.cargo || "");
  const chapterRoles = normalizeChapterRoles(row.chapterRoles);
  const chapters = Array.isArray(row.chapters)
    ?row.chapters.map(chapterKeyFromRelation).filter(Boolean)
    : [];
  const effectiveChapters = chapters.includes("RAS") && !chapters.includes("CAS")
    ?[...chapters, "CAS"]
    : chapters;
  const user = {
    cargo,
    chapterRoles,
    chapters: effectiveChapters,
    id: row.id,
    isAdmin: Boolean(row.isAdmin),
    email: row.email || "",
    name: row.name,
    username: row.username,
  };
  const manageableChapters = getManageableChapterKeys(user);

  return {
    ...user,
    canManageMembers: manageableChapters.length > 0,
    manageableChapters,
  };
}

function publicMemberOption(row, chapterKey = "") {
  if (!row) {
    return null;
  }

  const roles = normalizeChapterRoles(row.chapterRoles);
  const hasSpecificRoles = Object.keys(roles).length > 0;

  return {
    cargo: normalizeMemberRole(row.cargo, row.cargo || ""),
    chapterRoles: roles,
    email: row.email || "",
    id: row.id,
    name: row.name,
    usesChapterRoles: hasSpecificRoles,
  };
}

function normalizeChapterKeys(chapters, { allowAll = false } = {}) {
  if (allowAll) {
    return CHAPTER_KEYS;
  }

  const requested = Array.isArray(chapters) ?chapters : [];
  const valid = new Set(CHAPTER_KEYS);
  return [
    ...new Set(
      requested
        .map((item) => normalizarSociedadeChave(item, ""))
        .filter((item) => valid.has(item)),
    ),
  ];
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

function validatePasswordPolicy(password, label = "A senha") {
  const cleanPassword = String(password || "");
  if (cleanPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`${label} precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  if (!/[a-z]/.test(cleanPassword) || !/[A-Z]/.test(cleanPassword) || !/[0-9]/.test(cleanPassword)) {
    throw new Error(`${label} precisa incluir letras maiusculas, minusculas e números.`);
  }
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

  return rows.map((row) => normalizarSociedadeChave(row.chapterKey, "")).filter(Boolean);
}

export function isChapterMember(user, chapterKey) {
  return Boolean(user?.chapters?.includes(normalizarSociedadeChave(chapterKey, "")));
}

export async function createUser(
  { cargo, chapterRoles, chapters, email, name, password, username },
  options = {},
) {
  const cleanUsername = normalizeUsername(username || email);
  const cleanName = String(name || "").trim();
  const cleanCargo = normalizeMemberRole(cargo, "Membro");
  const cleanEmail = normalizeEmail(email, internalEmailForUsername(cleanUsername));
  const cleanPassword = String(password || "");
  const isAdmin = Boolean(options.isAdmin);
  const userChapters = normalizeChapterKeys(chapters, { allowAll: isAdmin });
  const cleanChapterRoles = rolesForChapters(chapterRoles, userChapters, cleanCargo);

  if (!cleanName) {
    throw new Error("Informe o nome do usuário.");
  }

  if (!cleanUsername || !/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
    throw new Error("Informe um nome de usuário com 3 a 40 caracteres, usando letras, números, ponto, hífen ou underline.");
  }

  validatePasswordPolicy(cleanPassword, "A senha");

  if (!userChapters.length) {
    throw new Error("Associe o usuário a pelo menos um capítulo.");
  }

  const { passwordHash, passwordSalt } = hashPassword(cleanPassword);
  const user = await getPrisma().user.create({
    data: {
      chapters: {
        create: userChapters.map((chapterKey) => ({ chapterKey })),
      },
      cargo: cleanCargo,
      chapterRoles: cleanChapterRoles,
      email: cleanEmail,
      isAdmin,
      name: cleanName,
      passwordHash,
      passwordSalt,
      username: cleanUsername,
    },
    include: { chapters: true },
  });

  try {
    await notifyUserWelcome({ initialPassword: cleanPassword, user });
  } catch (error) {
    console.error("Falha ao enviar e-mail de boas-vindas.", error);
  }

  const createdUser = publicUser(user);
  const firebaseUid = await syncFirebaseAuthUser(createdUser, { password: cleanPassword });
  await syncInternalUserToFirebase({ ...createdUser, firebaseUid: firebaseUid || "" });
  return createdUser;
}

export async function verifyCredentials(username, password) {
  const cleanUsername = normalizeUsername(username);
  const row = await getPrisma().user.findUnique({
    include: { chapters: true },
    where: { username: cleanUsername },
  });

  if (!row) {
    return null;
  }

  const currentTime = nowDate();
  if (row.lockedUntil && row.lockedUntil > currentTime) {
    throw new AuthSecurityError(
      "Muitas tentativas invalidas. Aguarde alguns minutos e tente novamente.",
      429,
      Math.max(1, Math.ceil((row.lockedUntil.getTime() - currentTime.getTime()) / 1000)),
    );
  }

  if (!verifyPassword(String(password || ""), row.passwordSalt, row.passwordHash)) {
    const failedLoginCount = Number(row.failedLoginCount || 0) + 1;
    const shouldLock = failedLoginCount >= LOGIN_FAILURE_LIMIT;
    const lockedUntil = shouldLock
      ?new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000)
      : null;

    await getPrisma().user.update({
      data: {
        failedLoginCount: shouldLock ?0 : failedLoginCount,
        lockedUntil,
      },
      where: { id: row.id },
    });

    return null;
  }

  if (row.failedLoginCount || row.lockedUntil) {
    await getPrisma().user.update({
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
      where: { id: row.id },
    });
  }

  return publicUser(row);
}

export async function changeOwnPassword(userId, currentPassword, newPassword) {
  const cleanPassword = String(newPassword || "");
  validatePasswordPolicy(cleanPassword, "A nova senha");

  const user = await getPrisma().user.findUnique({
    include: { chapters: true },
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
  await syncFirebaseAuthUser(publicUser(user), { password: cleanPassword });
}

export async function listUsers() {
  const users = await getPrisma().user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
  });

  return users.map(publicUser);
}

export async function syncUsersToFirebase() {
  const users = await listUsers();
  const syncedUsers = [];
  for (const user of users) {
    const firebaseUid = await syncFirebaseAuthUser(user);
    syncedUsers.push({ ...user, firebaseUid: firebaseUid || "" });
  }
  await syncInternalUsersToFirebase(syncedUsers);
  return users.length;
}

function limitPublicUserToChapters(user, chapterKeys) {
  const allowed = new Set(chapterKeys);
  const chapterRoles = Object.fromEntries(
    Object.entries(user.chapterRoles || {}).filter(([chapterKey]) => allowed.has(chapterKey)),
  );
  const limitedUser = {
    ...user,
    chapterRoles,
    chapters: user.chapters.filter((chapterKey) => allowed.has(chapterKey)),
  };
  const manageableChapters = getManageableChapterKeys(limitedUser);

  return {
    ...limitedUser,
    canManageMembers: manageableChapters.length > 0,
    manageableChapters,
  };
}

export async function listManageableUsers(user) {
  if (user.isAdmin) {
    return listUsers();
  }

  const manageableChapters = getManageableChapterKeys(user);
  if (!manageableChapters.length) {
    return [];
  }

  const users = await getPrisma().user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
    where: {
      chapters: {
        some: {
          chapterKey: { in: expandirSociedadesParaBusca(manageableChapters) },
        },
      },
    },
  });

  return users
    .map(publicUser)
    .map((item) => limitPublicUserToChapters(item, manageableChapters));
}

export async function createUserFromManagement(currentUser, payload = {}) {
  if (!canManageMembers(currentUser)) {
    throw new Error("Você não tem permissão para gerenciar membros.");
  }

  if (currentUser.isAdmin) {
    return createUser(payload, {
      isAdmin: Boolean(payload.isAdmin),
    });
  }

  if (payload.isAdmin) {
    throw new Error("Somente administradores podem criar outros administradores.");
  }

  const manageableChapters = getManageableChapterKeys(currentUser);
  const requestedChapters = normalizeChapterKeys(payload.chapters);
  const hasInvalidChapter = requestedChapters.some(
    (chapterKey) => !manageableChapters.includes(chapterKey),
  );

  if (!requestedChapters.length || hasInvalidChapter) {
    throw new Error("Você só pode cadastrar membros nos capítulos que gerencia.");
  }

  const memberRoles = Object.fromEntries(
    requestedChapters.map((chapterKey) => [chapterKey, "Membro"]),
  );

  return createUser(
    {
      ...payload,
      cargo: "Membro",
      chapterRoles: memberRoles,
      chapters: requestedChapters,
    },
    { isAdmin: false },
  );
}

export async function listVisibleUsers(user, chapterKey = "") {
  const accessibleChapters = Array.isArray(user?.chapters)
    ?user.chapters.filter((chapter) => CHAPTER_KEYS.includes(chapter))
    : [];
  const requestedChapters = normalizeChapterKeys(chapterKey ?[chapterKey] : []);

  if (chapterKey && !requestedChapters.length) {
    return [];
  }

  if (!accessibleChapters.length && !user.isAdmin) {
    return [];
  }

  if (requestedChapters.length && !user.isAdmin && !accessibleChapters.includes(requestedChapters[0])) {
    return [];
  }

  const isRamoContext = requestedChapters.includes("Ramo");
  const visibleChapters = requestedChapters.length
    ?isRamoContext && isRamoBoardMember(user)
      ?CHAPTER_KEYS
      : requestedChapters
    : user.isAdmin
      ?CHAPTER_KEYS
      : accessibleChapters;

  const users = await getPrisma().user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
    where: {
      chapters: {
        some: {
          chapterKey: { in: expandirSociedadesParaBusca(visibleChapters) },
        },
      },
    },
  });

  return users.map((row) => publicMemberOption(row, requestedChapters[0] || ""));
}

export async function updateUserManagement(currentUser, targetUserId, payload = {}) {
  const hasAdminUpdate = typeof payload.isAdmin === "boolean";
  if (hasAdminUpdate && currentUser.id === targetUserId) {
    throw new Error("Você não pode alterar sua própria permissão de administrador.");
  }

  const targetUser = await getPrisma().user.findUnique({
    include: { chapters: true },
    where: { id: targetUserId },
  });

  if (!targetUser) {
    return null;
  }

  const shouldBeAdmin = hasAdminUpdate ?Boolean(payload.isAdmin) : Boolean(targetUser.isAdmin);
  const currentChapters = new Set(
    targetUser.chapters
      .map((chapter) => normalizarSociedadeChave(chapter.chapterKey, ""))
      .filter(Boolean),
  );
  const requestedChapters = normalizeChapterKeys(payload.chapters, { allowAll: shouldBeAdmin });
  const nextChapters = requestedChapters.length
    ?requestedChapters
    : [...currentChapters].filter((chapterKey) => CHAPTER_KEYS.includes(chapterKey));

  if (!nextChapters.length) {
    throw new Error("Associe o usuário a pelo menos um capítulo.");
  }

  const chaptersToCreate = nextChapters.filter((chapterKey) => !currentChapters.has(chapterKey));
  const chaptersToDelete = targetUser.chapters
    .map((chapter) => chapter.chapterKey)
    .filter((chapterKey) => !nextChapters.includes(normalizarSociedadeChave(chapterKey, "")));
  const cleanName = typeof payload.name === "string" ?payload.name.trim() : targetUser.name;
  const cleanEmail = Object.prototype.hasOwnProperty.call(payload, "email")
    ?normalizeEmail(payload.email, targetUser.email)
    : targetUser.email;
  const nextCargo = typeof payload.cargo === "string"
    ?normalizeMemberRole(payload.cargo, "Membro")
    : normalizeMemberRole(targetUser.cargo, "Membro");
  const nextChapterRoles = rolesForChapters(
    Object.prototype.hasOwnProperty.call(payload, "chapterRoles")
      ?payload.chapterRoles
      : targetUser.chapterRoles,
    nextChapters,
    "",
  );

  if (!cleanName) {
    throw new Error("Informe o nome do usuário.");
  }

  const updatedUser = await getPrisma().user.update({
    data: {
      cargo: nextCargo,
      chapterRoles: nextChapterRoles,
      chapters: chaptersToCreate.length || chaptersToDelete.length
        ?{
            create: chaptersToCreate.map((chapterKey) => ({ chapterKey })),
            deleteMany: chaptersToDelete.map((chapterKey) => ({ chapterKey })),
          }
        : undefined,
      isAdmin: shouldBeAdmin,
      email: cleanEmail,
      name: cleanName,
    },
    include: { chapters: true },
    where: { id: targetUserId },
  });

  const publicUpdatedUser = publicUser(updatedUser);
  const firebaseUid = await syncFirebaseAuthUser(publicUpdatedUser);
  await syncInternalUserToFirebase({ ...publicUpdatedUser, firebaseUid: firebaseUid || "" });
  return publicUpdatedUser;
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const createdAt = nowDate();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await getPrisma().$transaction(async (tx) => {
    await tx.session.create({
      data: {
        createdAt,
        expiresAt,
        lastSeenAt: createdAt,
        tokenHash,
        userId,
      },
    });

    const staleSessions = await tx.session.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true },
      skip: MAX_ACTIVE_SESSIONS_PER_USER,
      where: { userId },
    });

    if (staleSessions.length) {
      await tx.session.deleteMany({
        where: { id: { in: staleSessions.map((session) => session.id) } },
      });
    }
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

export async function getUserByEmail(email) {
  const cleanEmail = normalizeEmail(email, "");
  if (!cleanEmail) {
    return null;
  }

  const row = await getPrisma().user.findUnique({
    include: { chapters: true },
    where: { email: cleanEmail },
  });

  return publicUser(row);
}

export function setSessionCookie(response, token, expiresAt) {
  const expires = new Date(expiresAt);
  response.cookies.set({
    expires,
    httpOnly: true,
    maxAge: Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000)),
    name: SESSION_COOKIE,
    path: "/",
    priority: "high",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: token,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set({
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    name: SESSION_COOKIE,
    path: "/",
    priority: "high",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: "",
  });
}

export function isSameOriginRequest(request) {
  const expectedOrigin = getRequestOrigin(request);
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) {
    return false;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  return true;
}
