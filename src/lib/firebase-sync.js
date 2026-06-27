import crypto from "node:crypto";
import fs from "node:fs";

const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

let accessTokenCache;
let syncWarningShown = false;

function firebaseSyncEnabled() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function readServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    return JSON.parse(rawJson);
  }

  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
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

function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    scope: FIRESTORE_SCOPE,
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
    throw new Error(`Falha ao autenticar no Firebase (${response.status}).`);
  }

  const payload = await response.json();
  accessTokenCache = {
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000,
    token: payload.access_token,
  };
  return accessTokenCache.token;
}

async function getFirestoreContext() {
  if (!firebaseSyncEnabled()) {
    return null;
  }

  const serviceAccount = readServiceAccount();
  if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error("Service account Firebase inválida.");
  }

  return {
    baseUrl: `https://firestore.googleapis.com/v1/projects/${serviceAccount.project_id}/databases/(default)/documents`,
    token: await getAccessToken(serviceAccount),
  };
}

function firestoreValue(value) {
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (Number.isInteger(value)) {
    return { integerValue: String(value) };
  }

  return { stringValue: String(value ?? "") };
}

function firestoreDocument(data) {
  return {
    fields: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]),
    ),
  };
}

function taskDocumentId(task) {
  return `atas-task-${task.id}`;
}

function eventDocumentId(event) {
  return `atas-event-${event.id}`;
}

function taskPayload(task) {
  return {
    chapter: task.chapter,
    completed: task.status === "done",
    description: task.description || "",
    source: "atas",
    sourceId: String(task.id),
    title: task.title || "",
    updatedAt: new Date(),
  };
}

function eventPayload(event) {
  return {
    chapter: event.chapter,
    description: event.description || "",
    endTime: event.endTime instanceof Date ?event.endTime : new Date(event.endTime),
    location: event.location || "",
    recurrenceCount: event.recurrenceCount || "",
    recurrenceFrequency: event.recurrenceFrequency || "",
    recurrenceIndex: Number.isInteger(event.recurrenceIndex) ?event.recurrenceIndex : "",
    recurrenceSeriesId: event.recurrenceSeriesId || "",
    source: "atas",
    sourceId: String(event.id),
    startTime: event.startTime instanceof Date ?event.startTime : new Date(event.startTime),
    title: event.title || "",
    updatedAt: new Date(),
  };
}

async function patchDocument(context, collection, id, payload) {
  const params = new URLSearchParams();
  Object.keys(payload).forEach((key) => params.append("updateMask.fieldPaths", key));

  const response = await fetch(`${context.baseUrl}/${collection}/${id}?${params.toString()}`, {
    body: JSON.stringify(firestoreDocument(payload)),
    headers: {
      Authorization: `Bearer ${context.token}`,
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(`Falha ao gravar ${collection}/${id} no Firebase (${response.status}).`);
  }
}

async function deleteDocument(context, collection, id) {
  const response = await fetch(`${context.baseUrl}/${collection}/${id}`, {
    headers: { Authorization: `Bearer ${context.token}` },
    method: "DELETE",
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Falha ao excluir ${collection}/${id} no Firebase (${response.status}).`);
  }
}

async function safeFirebaseSync(operation) {
  let context;
  try {
    context = await getFirestoreContext();
    if (!context) {
      return;
    }

    await operation(context);
  } catch (error) {
    if (!syncWarningShown) {
      console.warn("Falha ao sincronizar com Firebase. O registro local foi mantido.", error);
      syncWarningShown = true;
    }
  }
}

export async function syncTaskToFirebase(task) {
  await safeFirebaseSync((context) =>
    patchDocument(context, "tasks", taskDocumentId(task), taskPayload(task)),
  );
}

export async function deleteTaskFromFirebase(task) {
  await safeFirebaseSync((context) => deleteDocument(context, "tasks", taskDocumentId(task)));
}

export async function syncEventToFirebase(event) {
  await safeFirebaseSync((context) =>
    patchDocument(context, "events", eventDocumentId(event), eventPayload(event)),
  );
}

export async function syncEventsToFirebase(events) {
  await safeFirebaseSync((context) =>
    Promise.all(events.map((event) =>
      patchDocument(context, "events", eventDocumentId(event), eventPayload(event)),
    )),
  );
}

export async function deleteEventFromFirebase(event) {
  await safeFirebaseSync((context) => deleteDocument(context, "events", eventDocumentId(event)));
}
