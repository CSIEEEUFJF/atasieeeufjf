import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { notifyBranchAboutSiteInterest } from "../../../lib/email-notifications";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_INTEREST_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 2500;
const globalForSiteInterest = globalThis;

if (!globalForSiteInterest.siteInterestRateLimits) {
  globalForSiteInterest.siteInterestRateLimits = new Map();
}

class SiteInterestInputError extends Error {}

function responseHeaders(headers = {}) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  };
}

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function checkRateLimit(request) {
  const now = Date.now();
  const key = getClientIp(request);
  const attempts = (globalForSiteInterest.siteInterestRateLimits.get(key) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (attempts.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - attempts[0]);
    return Math.max(1, Math.ceil(retryAfterMs / 1000));
  }

  attempts.push(now);
  globalForSiteInterest.siteInterestRateLimits.set(key, attempts);
  return 0;
}

function hasValidApiToken(request) {
  const expectedToken = String(process.env.SITE_INTEREST_API_TOKEN || "");
  if (!expectedToken) {
    return true;
  }

  const authorization = request.headers.get("authorization") || "";
  const receivedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const expectedBuffer = Buffer.from(expectedToken);
  const receivedBuffer = Buffer.from(receivedToken);

  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function cleanText(value, maxLength, fieldLabel, { multiline = false, required = true } = {}) {
  const rawValue = String(value || "").replaceAll("\0", "").trim();
  const cleanValue = multiline ? rawValue : rawValue.replace(/\s+/g, " ");
  if (required && !cleanValue) {
    throw new SiteInterestInputError(`Informe ${fieldLabel}.`);
  }

  if (cleanValue.length > maxLength) {
    throw new SiteInterestInputError(`${fieldLabel} excede o limite permitido.`);
  }

  return cleanValue;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new SiteInterestInputError("Dados do formulário inválidos.");
  }

  const name = cleanText(payload.name, MAX_NAME_LENGTH, "o nome");
  if (name.length < 2) {
    throw new SiteInterestInputError("Informe um nome válido.");
  }

  const email = cleanText(payload.email, MAX_EMAIL_LENGTH, "o e-mail").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SiteInterestInputError("Informe um e-mail válido.");
  }

  const interest = cleanText(payload.interest, MAX_INTEREST_LENGTH, "a área de interesse");
  const message = cleanText(
    payload.message,
    MAX_MESSAGE_LENGTH,
    "a mensagem",
    { multiline: true, required: false },
  );

  if (payload.consent !== true) {
    throw new SiteInterestInputError("Autorize o uso dos dados para enviar o interesse.");
  }

  return {
    email,
    interest,
    language: payload.language === "en" ? "en" : "pt",
    message,
    name,
    website: cleanText(payload.website, 200, "o site", { required: false }),
  };
}

export async function POST(request) {
  if (!hasValidApiToken(request)) {
    return NextResponse.json(
      { detail: "Credencial da integração inválida." },
      { headers: responseHeaders(), status: 401 },
    );
  }

  const retryAfterSeconds = checkRateLimit(request);
  if (retryAfterSeconds) {
    return NextResponse.json(
      { detail: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      {
        headers: responseHeaders({ "Retry-After": String(retryAfterSeconds) }),
        status: 429,
      },
    );
  }

  try {
    const payload = validatePayload(await request.json());

    if (payload.website) {
      return NextResponse.json({ ok: true }, { headers: responseHeaders() });
    }

    const notification = await notifyBranchAboutSiteInterest(payload);
    if (!notification.enabled || notification.sent !== 1) {
      return NextResponse.json(
        { detail: "O envio de e-mail está temporariamente indisponível." },
        { headers: responseHeaders(), status: 503 },
      );
    }

    return NextResponse.json({ ok: true }, { headers: responseHeaders() });
  } catch (error) {
    if (error instanceof SiteInterestInputError || error instanceof SyntaxError) {
      return NextResponse.json(
        { detail: error.message || "Dados do formulário inválidos." },
        { headers: responseHeaders(), status: 400 },
      );
    }

    console.error("Falha ao enviar interesse recebido pelo site.", error);
    return NextResponse.json(
      { detail: "Não foi possível enviar o interesse neste momento." },
      { headers: responseHeaders(), status: 502 },
    );
  }
}
