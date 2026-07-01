import crypto from "node:crypto";

import { getUserById } from "./auth";

const MOBILE_SESSION_DAYS = 14;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input) {
  const normalized = String(input || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function mobileSessionSecret() {
  return process.env.MOBILE_SESSION_SECRET ||
    process.env.PDF_FORWARD_TOKEN ||
    process.env.DATABASE_URL ||
    "dev-mobile-session-secret";
}

function signPayload(payload) {
  return base64Url(
    crypto
      .createHmac("sha256", mobileSessionSecret())
      .update(payload)
      .digest(),
  );
}

export function createMobileSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = base64Url(JSON.stringify({
    exp: now + MOBILE_SESSION_DAYS * 24 * 60 * 60,
    iat: now,
    sub: String(user.id),
  }));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export async function getMobileSessionUser(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const [payloadPart, signature] = match[1].split(".");
  if (!payloadPart || !signature || signPayload(payloadPart) !== signature) {
    return null;
  }

  const payload = JSON.parse(base64UrlDecode(payloadPart));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || payload.exp <= now) {
    return null;
  }

  return getUserById(Number(payload.sub));
}
