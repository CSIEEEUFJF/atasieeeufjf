import crypto from "node:crypto";
import fs from "node:fs";

let firebaseAuthWarningShown = false;
let accessTokenCache;

const FIREBASE_AUTH_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

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

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(serviceAccount, claimOverrides = {}, { includeScope = true } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    ...(includeScope ? { scope: FIREBASE_AUTH_SCOPE } : {}),
    ...claimOverrides,
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(serviceAccount.private_key);

  return `${unsignedToken}.${base64Url(signature)}`;
}

async function getAccessToken(serviceAccount) {
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60_000) {
    return accessTokenCache.token;
  }

  const response = await fetch(TOKEN_URL, {
    body: new URLSearchParams({
      assertion: signJwt(serviceAccount),
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`firebase_auth_token_http_${response.status}`);
  }

  const payload = await response.json();
  accessTokenCache = {
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
    token: payload.access_token,
  };
  return accessTokenCache.token;
}

async function getFirebaseAuthContext({ strict = false } = {}) {
  if (!firebaseAdminEnabled()) {
    if (strict) {
      throw new Error("firebase_admin_missing_credentials");
    }
    return null;
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error(`firebase_admin_invalid_service_account:${serviceAccountSource()}`);
  }

  return {
    accountsUrl: `https://identitytoolkit.googleapis.com/v1/projects/${serviceAccount.project_id}/accounts`,
    projectId: serviceAccount.project_id,
    rootAccountsUrl: "https://identitytoolkit.googleapis.com/v1/accounts",
    serviceAccount,
    token: await getAccessToken(serviceAccount),
  };
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

async function firebaseAuthRequest(context, url, payload) {
  const response = await fetch(url, {
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${context.token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `firebase_auth_http_${response.status}`;
    const error = new Error(message);
    error.code = message;
    throw error;
  }

  return body;
}

async function getFirebaseUserByEmail(context, email) {
  const payload = await firebaseAuthRequest(context, `${context.accountsUrl}:lookup`, { email: [email] });
  return Array.isArray(payload.users) && payload.users.length ? payload.users[0] : null;
}

async function createFirebaseUser(context, user, email, password) {
  return firebaseAuthRequest(context, `${context.rootAccountsUrl}:signUp`, {
    disabled: false,
    displayName: user.name || email,
    email,
    emailVerified: false,
    password,
    targetProjectId: context.projectId,
  });
}

async function updateFirebaseUser(context, uid, user, email, password) {
  return firebaseAuthRequest(context, `${context.accountsUrl}:update`, {
    customAttributes: JSON.stringify(customClaimsForUser(user)),
    disableUser: false,
    displayName: user.name || email,
    email,
    localId: uid,
    ...(password ? { password } : {}),
  });
}

async function upsertFirebaseAuthUser(context, user, options = {}) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email || email.endsWith("@local.atas-ieee")) {
    return null;
  }

  let firebaseUser;
  firebaseUser = await getFirebaseUserByEmail(context, email);
  if (!firebaseUser) {
    firebaseUser = await createFirebaseUser(context, user, email, options.password || randomPassword());
  }

  const uid = firebaseUser.localId || firebaseUser.uid;
  await updateFirebaseUser(context, uid, user, email, options.password);

  return uid;
}

async function safeFirebaseAuthSync(operation) {
  try {
    const context = await getFirebaseAuthContext();
    if (!context) {
      return null;
    }

    return await operation(context);
  } catch (error) {
    if (!firebaseAuthWarningShown) {
      console.warn("Falha ao sincronizar usuários com Firebase Auth.", error);
      firebaseAuthWarningShown = true;
    }
    return null;
  }
}

export async function syncFirebaseAuthUser(user, options = {}) {
  return safeFirebaseAuthSync((context) => upsertFirebaseAuthUser(context, user, options));
}

export async function createFirebaseCustomTokenForUser(user, options = {}) {
  return safeFirebaseAuthSync(async (context) => {
    const uid = await upsertFirebaseAuthUser(context, user, options);
    if (!uid) {
      return "";
    }
    return createCustomToken(context.serviceAccount, uid, customClaimsForUser(user));
  });
}

export async function createFirebaseCustomTokenForUserStrict(user, options = {}) {
  try {
    const context = await getFirebaseAuthContext({ strict: true });
    const uid = await upsertFirebaseAuthUser(context, user, options);
    if (!uid) {
      throw new Error("firebase_admin_user_without_uid");
    }
    return createCustomToken(context.serviceAccount, uid, customClaimsForUser(user));
  } catch (error) {
    throw new Error(`firebase_admin_token_error:${firebaseAdminErrorMessage(error)}`);
  }
}

export async function syncFirebaseAuthUsers(users) {
  return safeFirebaseAuthSync(async (context) => {
    let synced = 0;
    for (const user of users) {
      const uid = await upsertFirebaseAuthUser(context, user);
      if (uid) {
        synced += 1;
      }
    }
    return synced;
  });
}

function createCustomToken(serviceAccount, uid, claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(serviceAccount, {
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    claims,
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    uid: String(uid),
  }, { includeScope: false });
}
