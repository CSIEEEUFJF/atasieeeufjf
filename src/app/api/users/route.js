import { NextResponse } from "next/server";

import {
  createUser,
  getCurrentUser,
  isUniqueConstraintError,
  isSameOriginRequest,
  listVisibleUsers,
  listUsers,
} from "../../../lib/auth";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json(
    { detail: "Apenas administradores podem gerenciar membros." },
    { status: 403 },
  );
}

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get("scope") === "accessible") {
    return NextResponse.json({
      users: await listVisibleUsers(user, searchParams.get("chapter") || ""),
    });
  }

  if (!user?.isAdmin) {
    return forbidden();
  }

  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return forbidden();
  }

  try {
    const payload = await request.json();
    const user = await createUser(payload, { isAdmin: Boolean(payload.isAdmin) });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const duplicateUsername = isUniqueConstraintError(error);
    return NextResponse.json(
      {
        detail: duplicateUsername
          ? "Ja existe um membro com este nome de usuario."
          : error.message || "Nao foi possivel criar o usuario.",
      },
      { status: 400 },
    );
  }
}
