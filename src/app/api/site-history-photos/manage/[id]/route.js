import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../../lib/auth";
import {
  deleteHistoryPhoto,
  updateHistoryPhoto,
} from "../../../../../lib/site-history-photos";

export const runtime = "nodejs";

function parseId(params) {
  const id = Number.parseInt(params?.id || "", 10);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticacao necessaria." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export async function DELETE(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { detail: "Origem invalida." },
      { headers: noStoreHeaders(), status: 403 },
    );
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json(
      { detail: "Foto historica invalida." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  try {
    await deleteHistoryPhoto(currentUser, id);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel excluir a foto historica." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}

export async function PATCH(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { detail: "Origem invalida." },
      { headers: noStoreHeaders(), status: 403 },
    );
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  const id = parseId(await params);
  if (!id) {
    return NextResponse.json(
      { detail: "Foto historica invalida." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  try {
    const photo = await updateHistoryPhoto(currentUser, id, await request.json());
    return NextResponse.json({ photo }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel atualizar a foto historica." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
