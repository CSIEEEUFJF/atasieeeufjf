import { NextResponse } from "next/server";

import {
  canManageMembers,
  getCurrentUser,
  isSameOriginRequest,
} from "../../../../lib/auth";
import { getPrisma } from "../../../../lib/db";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

function forbidden() {
  return NextResponse.json(
    { detail: "Apenas a diretoria pode gerenciar membresias." },
    { status: 403 },
  );
}

export async function DELETE(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem inválida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!canManageMembers(user)) {
    return forbidden();
  }

  const params = await context.params;
  const id = Number.parseInt(params.id, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ detail: "Membresia inválida." }, { status: 400 });
  }

  await getPrisma().membershipMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
