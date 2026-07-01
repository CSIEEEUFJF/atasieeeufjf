import { NextResponse } from "next/server";

import { getFirebaseMobileUser } from "../../../../../../lib/firebase-mobile-auth";
import {
  deleteInternalTask,
  InternalAccessError,
  updateInternalTask,
} from "../../../../../../lib/internal";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao Firebase necessaria." }, { status: 401 });
}

function parseId(params) {
  const id = Number.parseInt(params?.id || "", 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export async function PATCH(request, { params }) {
  const user = await getFirebaseMobileUser(request);
  if (!user) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Tarefa invalida." }, { status: 400 });
  }

  try {
    const task = await updateInternalTask(user, id, await request.json());
    if (!task) {
      return NextResponse.json({ detail: "Tarefa não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível atualizar a tarefa." },
      { status: 400 },
    );
  }
}

export async function DELETE(request, { params }) {
  const user = await getFirebaseMobileUser(request);
  if (!user) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json({ detail: "Tarefa invalida." }, { status: 400 });
  }

  try {
    const deleted = await deleteInternalTask(user, id);
    if (!deleted) {
      return NextResponse.json({ detail: "Tarefa não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível excluir a tarefa." },
      { status: 400 },
    );
  }
}
