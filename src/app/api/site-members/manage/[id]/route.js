import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../../lib/auth";
import {
  deleteSiteMember,
  updateSiteMember,
} from "../../../../../lib/site-members";

export const runtime = "nodejs";

function parseId(value) {
  const id = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

export async function PATCH(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  const params = await context.params;
  const memberId = parseId(params.id);
  if (!memberId) {
    return NextResponse.json({ detail: "Membro invalido." }, { status: 400 });
  }

  try {
    const payload = await request.json();
    const member = await updateSiteMember(currentUser, memberId, payload);
    return NextResponse.json({ member });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel atualizar o membro do site." },
      { status: 400 },
    );
  }
}

export async function DELETE(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  const params = await context.params;
  const memberId = parseId(params.id);
  if (!memberId) {
    return NextResponse.json({ detail: "Membro invalido." }, { status: 400 });
  }

  try {
    return NextResponse.json(await deleteSiteMember(currentUser, memberId));
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel remover o membro do site." },
      { status: 400 },
    );
  }
}
