import { cookies } from "next/headers";
import crypto from "node:crypto";

import { SOCIEDADES, SOCIEDADE_LABELS } from "./ata";
import { getDb, nowIso } from "./db";

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

function publicUser(row) {
  if (!row) {
    return null;
  }

  return {
    chapters: Array.isArray(row.chapters) ? row.chapters : getUserChapters(row.id),
    id: row.id,
    isAdmin: Boolean(row.is_admin),
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

function setUserChapters(db, userId, chapters) {
  const timestamp = nowIso();
  db.prepare("DELETE FROM user_chapters WHERE user_id = ?").run(userId);

  const insert = db.prepare(`
    INSERT INTO user_chapters (user_id, chapter_key, created_at)
    VALUES (?, ?, ?)
  `);

  for (const chapterKey of chapters) {
    insert.run(userId, chapterKey, timestamp);
  }
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

export function hasUsers() {
  const row = getDb().prepare("SELECT COUNT(*) AS count FROM users").get();
  return Number(row?.count || 0) > 0;
}

export function getChapterOptions() {
  return CHAPTER_KEYS.map((key) => ({
    key,
    label: SOCIEDADE_LABELS[key] || key,
  }));
}

export function getUserChapters(userId) {
  return getDb()
    .prepare(`
      SELECT chapter_key AS chapterKey
      FROM user_chapters
      WHERE user_id = ?
      ORDER BY chapter_key ASC
    `)
    .all(userId)
    .map((row) => row.chapterKey);
}

export function isChapterMember(user, chapterKey) {
  return Boolean(user?.chapters?.includes(chapterKey));
}

export function createUser({ chapters, email, name, password, username }, options = {}) {
  const cleanUsername = normalizeUsername(username || email);
  const cleanName = String(name || "").trim();
  const cleanPassword = String(password || "");
  const isAdmin = Boolean(options.isAdmin);
  const userChapters = normalizeChapterKeys(chapters, { allowAll: isAdmin && !Array.isArray(chapters) });

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
  const timestamp = nowIso();
  const db = getDb();

  const result = db.transaction(() => {
    const inserted = db
      .prepare(`
        INSERT INTO users (
          name, username, email, password_hash, password_salt, is_admin, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        cleanName,
        cleanUsername,
        internalEmailForUsername(cleanUsername),
        passwordHash,
        passwordSalt,
        isAdmin ? 1 : 0,
        timestamp,
        timestamp,
      );

    const userId = Number(inserted.lastInsertRowid);
    setUserChapters(db, userId, userChapters);
    return inserted;
  })();

  return publicUser({
    chapters: userChapters,
    id: Number(result.lastInsertRowid),
    is_admin: isAdmin ? 1 : 0,
    name: cleanName,
    username: cleanUsername,
  });
}

export function verifyCredentials(username, password) {
  const cleanUsername = normalizeUsername(username);
  const row = getDb()
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(cleanUsername);

  if (!row || !verifyPassword(String(password || ""), row.password_salt, row.password_hash)) {
    return null;
  }

  return publicUser(row);
}

export function listUsers() {
  return getDb()
    .prepare(`
      SELECT id, name, username, is_admin
      FROM users
      ORDER BY name COLLATE NOCASE ASC
    `)
    .all()
    .map(publicUser);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  getDb()
    .prepare(`
      INSERT INTO sessions (user_id, token_hash, expires_at, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(userId, tokenHash, expiresAt, createdAt, createdAt);

  return { expiresAt, token };
}

export function destroySession(token) {
  if (!token) {
    return;
  }

  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function deleteExpiredSessions() {
  getDb().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
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

  deleteExpiredSessions();

  const row = getDb()
    .prepare(`
      SELECT users.id, users.name, users.username, users.is_admin
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `)
    .get(hashToken(token), nowIso());

  if (!row) {
    return null;
  }

  getDb()
    .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
    .run(nowIso(), hashToken(token));

  return publicUser(row);
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
