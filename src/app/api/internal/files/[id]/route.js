import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../../lib/auth";
import { deleteInternalFile } from "../../../../../lib/internal-files";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

export async function DELETE(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem inválida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  const params = await context.params;
  const deleted = await deleteInternalFile(user, params.id);
  if (!deleted) {
    return NextResponse.json({ detail: "Arquivo não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
