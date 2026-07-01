import crypto from "node:crypto";
import fs from "node:fs";

let firebaseAuthWarningShown = false;

function firebaseAdminEnabled() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
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
    return normalizeServiceAccount(JSON.parse(Buffer.from(rawBase64, "base64").toString("utf8")));
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    return normalizeServiceAccount(JSON.parse(fs.readFileSync(path, "utf8")));
  }

  return null;
}

async function getFirebaseAuth() {
  if (!firebaseAdminEnabled()) {
    return null;
  }

  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");

  if (!getApps().length) {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
      throw new Error("Service account Firebase inválida.");
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return getAuth();
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
