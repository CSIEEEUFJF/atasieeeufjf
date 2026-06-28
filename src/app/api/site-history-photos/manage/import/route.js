import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../../lib/auth";
import { importHistoryPhotosFromDriveFolder } from "../../../../../lib/site-history-photos";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticacao necessaria." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export async function POST(request) {
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

  try {
    const result = await importHistoryPhotosFromDriveFolder(currentUser, await request.json());
    return NextResponse.json(result, { headers: noStoreHeaders(), status: 201 });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel importar fotos historicas." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
