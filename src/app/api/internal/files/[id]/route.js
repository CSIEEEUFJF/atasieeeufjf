import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../../lib/auth";
import {
  deleteInternalFile,
  StorageDisabledError,
  StorageUnavailableError,
} from "../../../../../lib/internal-files";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

function storageUnavailable(error) {
  return NextResponse.json(
    { code: "storage_unavailable", detail: error.message || "Serviço de dados indisponível." },
    { status: 503 },
  );
}

function storageDisabled(error) {
  return NextResponse.json(
    { code: "storage_disabled", detail: error.message || "Armazenamento desabilitado por enquanto." },
    { status: 503 },
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

  try {
    const params = await context.params;
    const deleted = await deleteInternalFile(user, params.id);
    if (!deleted) {
      return NextResponse.json({ detail: "Arquivo não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StorageDisabledError) {
      return storageDisabled(error);
    }
    if (error instanceof StorageUnavailableError) {
      return storageUnavailable(error);
    }
    throw error;
  }
}
