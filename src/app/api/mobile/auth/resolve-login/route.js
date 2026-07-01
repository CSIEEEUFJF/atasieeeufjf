import { NextResponse } from "next/server";
import fs from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

import { getPrisma } from "../../../../../lib/db";
import { noStoreHeaders, verifyCredentials } from "../../../../../lib/auth";

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

function firebaseAdminAvailable() {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function firestoreAdmin() {
  if (!firebaseAdminAvailable()) {
    return null;
  }

  if (!getApps().length) {
    const serviceAccount = readServiceAccount();
    if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
      return null;
    }

    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  return getFirestore();
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

async function resolveFromInternalUsers(identifier) {
  try {
    const db = firestoreAdmin();
    if (!db) {
      return "";
    }

    const email = normalizeEmail(identifier);
    const usernames = usernameCandidates(identifier).slice(0, 10);
    const collection = db.collection("internalUsers");

    if (email.includes("@")) {
      const emailSnapshot = await collection.where("email", "==", email).limit(1).get();
      const emailDoc = emailSnapshot.docs[0];
      const resolvedEmail = emailDoc?.get("email");
      if (resolvedEmail) {
        return normalizeEmail(resolvedEmail);
      }
    }

    const usernameSnapshot = await collection.where("username", "in", usernames).limit(1).get();
    const usernameDoc = usernameSnapshot.docs[0];
    const resolvedEmail = usernameDoc?.get("email");
    return resolvedEmail ? normalizeEmail(resolvedEmail) : "";
  } catch (error) {
    console.warn("Falha ao resolver login pelo Firestore internalUsers.", error);
    return "";
  }
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

  const resolvedEmail = await resolveFromPrisma(identifier)
    || await resolveFromInternalUsers(identifier);

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
    const identifier = String(name || username || "").trim();

    if (!identifier || !password) {
      return NextResponse.json(
        { detail: "Informe usuário e senha." },
        { headers: noStoreHeaders(), status: 400 },
      );
    }

    const user = await verifyCredentials(identifier, password);
    if (!user?.email) {
      return NextResponse.json(
        { detail: "Usuário ou senha inválidos." },
        { headers: noStoreHeaders(), status: 401 },
      );
    }

    return NextResponse.json(
      { email: normalizeEmail(user.email) },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível validar o login." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
