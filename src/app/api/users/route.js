import { NextResponse } from "next/server";

import {
  canManageMembers,
  createUserFromManagement,
  getCurrentUser,
  isUniqueConstraintError,
  isSameOriginRequest,
  listManageableUsers,
  listVisibleUsers,
} from "../../../lib/auth";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json(
    { detail: "Apenas administradores ou gestores de capitulo podem gerenciar membros." },
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

  if (!canManageMembers(user)) {
    return forbidden();
  }

  return NextResponse.json({ users: await listManageableUsers(user) });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!canManageMembers(currentUser)) {
    return forbidden();
  }

  try {
    const payload = await request.json();
    const user = await createUserFromManagement(currentUser, payload);
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
