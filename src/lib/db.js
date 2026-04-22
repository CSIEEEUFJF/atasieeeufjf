import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { SOCIEDADES } from "./ata";

const DEFAULT_DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = process.env.ATAS_DB_PATH
  || path.join(process.env.ATAS_DB_DIR || DEFAULT_DATA_DIR, "atas-ieee.sqlite");
const DATA_DIR = process.env.ATAS_DB_DIR || path.dirname(DB_PATH);

let database;

function columnExists(db, table, column) {
  return db.pragma(`table_info(${table})`).some((item) => item.name === column);
}

function normalizeUsernameCandidate(value, fallback = "usuario") {
  const normalized = String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9A-Za-z._-]+/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

function usernameFromUser(row) {
  const emailLocalPart = String(row.email || "").split("@")[0];
  return normalizeUsernameCandidate(emailLocalPart || row.name || `usuario-${row.id}`);
}

function backfillUsernames(db) {
  const users = db
    .prepare("SELECT id, name, email, username FROM users ORDER BY id ASC")
    .all();
  const used = new Set(users.map((user) => user.username).filter(Boolean));
  const update = db.prepare("UPDATE users SET username = ?, updated_at = ? WHERE id = ?");

  for (const user of users) {
    if (user.username) {
      continue;
    }

    const base = usernameFromUser(user);
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}${suffix}`;
      suffix += 1;
    }

    used.add(candidate);
    update.run(candidate, nowIso(), user.id);
  }
}

function migrate(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS atas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      sociedade TEXT NOT NULL,
      output_name TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ata_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ata_id INTEGER NOT NULL,
      client_id TEXT NOT NULL,
      legenda TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      content BLOB,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (ata_id) REFERENCES atas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_chapters (
      user_id INTEGER NOT NULL,
      chapter_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, chapter_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_atas_user_updated ON atas(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_atas_sociedade_updated ON atas(sociedade, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attachments_ata_position ON ata_attachments(ata_id, position);
    CREATE INDEX IF NOT EXISTS idx_user_chapters_chapter ON user_chapters(chapter_key);
  `);

  if (!columnExists(db, "users", "is_admin")) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
  }

  if (!columnExists(db, "users", "username")) {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
  }

  backfillUsernames(db);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)");

  const timestamp = nowIso();
  const hasUserRows = Number(db.prepare("SELECT COUNT(*) AS count FROM users").get()?.count || 0) > 0;
  const hasAdminRows = Number(db.prepare("SELECT COUNT(*) AS count FROM users WHERE is_admin = 1").get()?.count || 0) > 0;

  if (hasUserRows && !hasAdminRows) {
    db.prepare(`
      UPDATE users
      SET is_admin = 1, updated_at = ?
      WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)
    `).run(timestamp);
  }

  const chapterKeys = Object.keys(SOCIEDADES);
  const insertChapter = db.prepare(`
    INSERT OR IGNORE INTO user_chapters (user_id, chapter_key, created_at)
    SELECT id, ?, ?
    FROM users
    WHERE is_admin = 1
  `);

  for (const chapterKey of chapterKeys) {
    insertChapter.run(chapterKey, timestamp);
  }

  db.prepare(`
    INSERT OR IGNORE INTO user_chapters (user_id, chapter_key, created_at)
    SELECT DISTINCT user_id, sociedade, ?
    FROM atas
    WHERE sociedade IS NOT NULL AND sociedade != ''
  `).run(timestamp);
}

export function getDb() {
  if (!database) {
    mkdirSync(DATA_DIR, { recursive: true });
    database = new Database(DB_PATH);
    database.pragma("foreign_keys = ON");
    migrate(database);
  }

  return database;
}

export function nowIso() {
  return new Date().toISOString();
}
