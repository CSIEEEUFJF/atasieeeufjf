import crypto from "node:crypto";
import fs from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let firebaseAuthWarningShown = false;

function serviceAccountSource() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return "FIREBASE_SERVICE_ACCOUNT_JSON";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) return "FIREBASE_SERVICE_ACCOUNT_BASE64";
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) return "FIREBASE_SERVICE_ACCOUNT_PATH";
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return "GOOGLE_APPLICATION_CREDENTIALS";
  return "";
}

function firebaseAdminEnabled() {
  return Boolean(serviceAccountSource());
}

function normalizeServiceAccount(serviceAccount) {
  if (!serviceAccount) {
    return null;
  }

  return {
    ...serviceAccount,
    private_key: String(serviceAccount.private_key || "").replace(/\\n/g, "\n"),
  };
}

function readServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return normalizeServiceAccount(JSON.parse(rawJson));
  }

  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (rawBase64) {
    const cleanBase64 = rawBase64.trim().replace(/\s+/g, "");
    return normalizeServiceAccount(JSON.parse(Buffer.from(cleanBase64, "base64").toString("utf8")));
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    return normalizeServiceAccount(JSON.parse(fs.readFileSync(path, "utf8")));
  }

  return null;
}

async function getFirebaseAuth({ strict = false } = {}) {
  if (!firebaseAdminEnabled()) {
    if (strict) {
      throw new Error("firebase_admin_missing_credentials");
    }
    return null;
  }

  if (!getApps().length) {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
      throw new Error(`firebase_admin_invalid_service_account:${serviceAccountSource()}`);
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return getAuth();
}

function firebaseAdminErrorMessage(error) {
  const code = error?.code ? String(error.code) : "";
  const message = error?.message ? String(error.message) : "unknown_error";

  if (code) {
    return code;
  }

  if (message.includes("private_key")) return "invalid_private_key";
  if (message.includes("DECODER") || message.includes("PEM")) return "invalid_private_key_pem";
  if (message.includes("JSON")) return "service_account_parse_error";
  if (message.includes("credential")) return "invalid_credential";

  return message.split("\n")[0].slice(0, 180);
}

function randomPassword() {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  return Array.from(crypto.randomBytes(32), (byte) => alphabet[byte % alphabet.length]).join("");
}

function customClaimsForUser(user) {
  return {
    chapters: Array.isArray(user.chapters) ? user.chapters : [],
    internalUserId: String(user.id),
    isInternalAdmin: Boolean(user.isAdmin),
    source: "atas",
    username: user.username || "",
  };
}

async function upsertFirebaseAuthUser(auth, user, options = {}) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email || email.endsWith("@local.atas-ieee")) {
    return null;
  }

  let firebaseUser;
  try {
    firebaseUser = await auth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }

    firebaseUser = await auth.createUser({
      disabled: false,
      displayName: user.name || email,
      email,
      emailVerified: false,
      password: options.password || randomPassword(),
    });
  }

  await auth.updateUser(firebaseUser.uid, {
    disabled: false,
    displayName: user.name || email,
    email,
    ...(options.password ? { password: options.password } : {}),
  });
  await auth.setCustomUserClaims(firebaseUser.uid, customClaimsForUser(user));

  return firebaseUser.uid;
}

async function safeFirebaseAuthSync(operation) {
  try {
    const auth = await getFirebaseAuth();
    if (!auth) {
      return null;
    }

    return await operation(auth);
  } catch (error) {
    if (!firebaseAuthWarningShown) {
      console.warn("Falha ao sincronizar usuários com Firebase Auth.", error);
      firebaseAuthWarningShown = true;
    }
    return null;
  }
}

export async function syncFirebaseAuthUser(user, options = {}) {
  return safeFirebaseAuthSync((auth) => upsertFirebaseAuthUser(auth, user, options));
}

export async function createFirebaseCustomTokenForUser(user, options = {}) {
  return safeFirebaseAuthSync(async (auth) => {
    const uid = await upsertFirebaseAuthUser(auth, user, options);
    if (!uid) {
      return "";
    }
    return auth.createCustomToken(uid, customClaimsForUser(user));
  });
}

export async function createFirebaseCustomTokenForUserStrict(user, options = {}) {
  try {
    const auth = await getFirebaseAuth({ strict: true });
    const uid = await upsertFirebaseAuthUser(auth, user, options);
    if (!uid) {
      throw new Error("firebase_admin_user_without_uid");
    }
    return await auth.createCustomToken(uid, customClaimsForUser(user));
  } catch (error) {
    throw new Error(`firebase_admin_token_error:${firebaseAdminErrorMessage(error)}`);
  }
}

export async function syncFirebaseAuthUsers(users) {
  return safeFirebaseAuthSync(async (auth) => {
    let synced = 0;
    for (const user of users) {
      const uid = await upsertFirebaseAuthUser(auth, user);
      if (uid) {
        synced += 1;
      }
    }
    return synced;
  });
}
