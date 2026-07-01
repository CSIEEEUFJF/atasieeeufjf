import { NextResponse } from "next/server";

import { getMobileSessionUser } from "../../../../../../lib/mobile-session";
import {
  deleteInternalEvent,
  InternalAccessError,
  updateInternalEvent,
} from "../../../../../../lib/internal";

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

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Evento invalido." }, { status: 400 });
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
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Evento invalido." }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const deleted = await deleteInternalEvent(user, id, {
      series: searchParams.get("series") === "true",
    });
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
