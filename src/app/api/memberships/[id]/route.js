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
  const rawId = decodeURIComponent(String(params.id || "")).trim();
  if (!rawId) {
    return NextResponse.json({ detail: "Membresia inválida." }, { status: 400 });
  }

  if (rawId.startsWith("db-")) {
    const id = Number.parseInt(rawId.slice(3), 10);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ detail: "Membresia inválida." }, { status: 400 });
    }

    await getPrisma().membershipMember.update({
      data: { isDeleted: true },
      where: { id },
    });
    return NextResponse.json({ ok: true });
  }

  const memberNumber = rawId.startsWith("member-") ? rawId.slice(7) : rawId;
  await getPrisma().membershipMember.upsert({
    create: {
      email: `${memberNumber}@deleted.local`,
      isDeleted: true,
      memberNumber,
      name: "Membro removido",
      source: "deleted",
    },
    update: {
      isDeleted: true,
      source: "deleted",
    },
    where: { memberNumber },
  });

  return NextResponse.json({ ok: true });
}
