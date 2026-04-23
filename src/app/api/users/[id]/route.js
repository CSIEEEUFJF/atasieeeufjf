import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  updateUserManagement,
} from "../../../../lib/auth";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json(
    { detail: "Apenas administradores podem gerenciar membros." },
    { status: 403 },
  );
}

function parseId(value) {
  const id = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser?.isAdmin) {
    return forbidden();
  }

  const params = await context.params;
  const userId = parseId(params.id);
  if (!userId) {
    return NextResponse.json({ detail: "Usuario invalido." }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const hasKnownField = ["cargo", "chapterRoles", "chapters", "isAdmin", "name"].some((field) =>
      Object.prototype.hasOwnProperty.call(payload, field),
    );

    if (!hasKnownField) {
      return NextResponse.json(
        { detail: "Informe pelo menos um campo para atualizar." },
        { status: 400 },
      );
    }

    const user = await updateUserManagement(currentUser, userId, payload);
    if (!user) {
      return NextResponse.json({ detail: "Usuario nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel atualizar o usuario." },
      { status: 400 },
    );
  }
}
