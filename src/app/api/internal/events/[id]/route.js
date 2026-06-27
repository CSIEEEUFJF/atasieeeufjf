import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../../lib/auth";
import {
  deleteInternalEvent,
  InternalAccessError,
  updateInternalEvent,
} from "../../../../../lib/internal";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

function parseId(params) {
  const id = Number.parseInt(params?.id || "", 10);
  return Number.isSafeInteger(id) && id > 0 ?id : 0;
}

export async function PATCH(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Evento inválido." }, { status: 400 });
  }

  try {
    const event = await updateInternalEvent(user, id, await request.json());
    if (!event) {
      return NextResponse.json({ detail: "Evento não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível atualizar o evento." },
      { status: 400 },
    );
  }
}

export async function DELETE(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Evento inválido." }, { status: 400 });
  }

  try {
    const deleted = await deleteInternalEvent(user, id);
    if (!deleted) {
      return NextResponse.json({ detail: "Evento não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível excluir o evento." },
      { status: 400 },
    );
  }
}
