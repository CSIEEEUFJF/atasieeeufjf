import crypto from "node:crypto";
import fs from "node:fs";

import { getUserByEmail } from "./auth";

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let certCache = { expiresAt: 0, items: {} };

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

function firebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID || readServiceAccount()?.project_id || "";
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || "").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function decodeJwtPart(value) {
  return JSON.parse(base64UrlDecode(value));
}

async function getFirebaseCerts() {
  if (certCache.expiresAt > Date.now() + 60_000) {
    return certCache.items;
  }

  const response = await fetch(FIREBASE_CERTS_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Falha ao consultar certificados Firebase (${response.status}).`);
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeMs = Number(maxAgeMatch?.[1] || 3600) * 1000;
  certCache = {
    expiresAt: Date.now() + maxAgeMs,
    items: await response.json(),
  };

  return certCache.items;
}

async function verifyFirebaseIdToken(idToken) {
  const projectId = firebaseProjectId();
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID ou service account Firebase não configurados.");
  }

  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Token Firebase inválido.");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJwtPart(headerPart);
  const payload = decodeJwtPart(payloadPart);
  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];
  if (header.alg !== "RS256" || !cert) {
    throw new Error("Assinatura Firebase inválida.");
  }

  const signature = Buffer.from(signaturePart.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerPart}.${payloadPart}`);
  verifier.end();
  if (!verifier.verify(cert, signature)) {
    throw new Error("Assinatura Firebase inválida.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Token Firebase de outro projeto.");
  }

  if (!payload.sub || payload.exp <= now || payload.iat > now + 60) {
    throw new Error("Token Firebase expirado ou inválido.");
  }

  return payload;
}

export async function getFirebaseMobileUser(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const payload = await verifyFirebaseIdToken(match[1]);
  const email = payload.email || "";
  if (!email) {
    return null;
  }

  return getUserByEmail(email);
}
