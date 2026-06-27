import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../../lib/auth";
import { deleteHomePhoto } from "../../../../../lib/site-home-photos";

export const runtime = "nodejs";

function parseId(params) {
  const id = Number.parseInt(params?.id || "", 10);
  return Number.isSafeInteger(id) && id > 0 ?id : 0;
}

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticação necessária." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export async function DELETE(request, { params }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { detail: "Origem inválida." },
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
      { detail: "Foto inválida." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  try {
    await deleteHomePhoto(currentUser, id);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível excluir a foto." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
