import { NextResponse } from "next/server";

import {
  createUser,
  getCurrentUser,
  isSameOriginRequest,
  listUsers,
} from "../../../lib/auth";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json(
    { detail: "Apenas administradores podem gerenciar membros." },
    { status: 403 },
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) {
    return forbidden();
  }

  return NextResponse.json({ users: listUsers() });
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
    const user = createUser(payload, { isAdmin: Boolean(payload.isAdmin) });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const duplicateUsername = error?.code === "SQLITE_CONSTRAINT_UNIQUE";
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
