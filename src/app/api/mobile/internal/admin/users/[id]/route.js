import { NextResponse } from "next/server";

import { updateUserManagement } from "../../../../../../../lib/auth";
import { getMobileSessionUser } from "../../../../../../../lib/mobile-session";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao pelo sistema interno necessaria." }, { status: 401 });
}

function parseId(params) {
  const id = Number.parseInt(params?.id || "", 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export async function PATCH(request, { params }) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!user.isAdmin) {
    return NextResponse.json({ detail: "Acesso restrito aos administradores." }, { status: 403 });
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Usuário inválido." }, { status: 400 });
  }

  try {
    const updatedUser = await updateUserManagement(user, id, await request.json());
    if (!updatedUser) {
      return NextResponse.json({ detail: "Usuário não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível atualizar o usuário." },
      { status: 400 },
    );
  }
}
