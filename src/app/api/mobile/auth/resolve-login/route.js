import { NextResponse } from "next/server";

import { getPrisma } from "../../../../../lib/db";
import { noStoreHeaders, verifyCredentials } from "../../../../../lib/auth";
import { createMobileSessionToken } from "../../../../../lib/mobile-session";

export const runtime = "nodejs";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

function usernameCandidates(value) {
  const normalized = normalizeUsername(value);
  const compact = normalized.replace(/\./g, "");
  return [...new Set([normalized, compact].filter(Boolean))];
}

async function resolveFromPrisma(identifier) {
  try {
    const email = normalizeEmail(identifier);
    const usernames = usernameCandidates(identifier);
    const user = await getPrisma().user.findFirst({
      select: { email: true },
      where: {
        OR: [
          { email },
          ...usernames.map((username) => ({ username })),
        ],
      },
    });

    return user?.email ? normalizeEmail(user.email) : "";
  } catch (error) {
    console.warn("Falha ao resolver login pelo banco interno.", error);
    return "";
  }
}

function absolutizeUserPhoto(user, request) {
  const photoUrl = String(user.profilePictureUrl || "");
  return {
    ...user,
    photoPositionX: Number(user.photoPositionX || 50),
    photoPositionY: Number(user.photoPositionY || 50),
    photoZoom: Number(user.photoZoom || 100),
    profilePictureUrl: photoUrl.startsWith("/")
      ?new URL(photoUrl, request.url).toString()
      : photoUrl,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const identifier = String(
    searchParams.get("name") ||
      searchParams.get("username") ||
      searchParams.get("identifier") ||
      "",
  ).trim();

  if (!identifier) {
    return NextResponse.json(
      { detail: "Informe o e-mail ou usuário." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const resolvedEmail = await resolveFromPrisma(identifier);

  if (!resolvedEmail) {
    return NextResponse.json(
      { detail: "Usuário não encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { email: resolvedEmail },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request) {
  try {
    const { name, password, username } = await request.json();
    const identifier = String(username || name || "").trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { detail: "Informe usuário e senha." },
        { headers: noStoreHeaders(), status: 400 },
      );
    }

    let user = await verifyCredentials(identifier, password);
    if (!user) {
      const resolvedEmail = await resolveFromPrisma(identifier);
      if (resolvedEmail && resolvedEmail !== identifier) {
        user = await verifyCredentials(resolvedEmail, password);
      }
    }
    if (!user?.email) {
      return NextResponse.json(
        { detail: "Usuário ou senha inválidos." },
        { headers: noStoreHeaders(), status: 401 },
      );
    }

    return NextResponse.json(
      {
        email: normalizeEmail(user.email),
        sessionToken: createMobileSessionToken(user),
        user: absolutizeUserPhoto(user, request),
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível validar o login." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
