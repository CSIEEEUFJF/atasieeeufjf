import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../lib/auth";
import {
  createHistoryPhoto,
  listManagedHistoryPhotos,
} from "../../../../lib/site-history-photos";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticacao necessaria." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

function forbidden(message = "Apenas gestores podem administrar fotos historicas do site.") {
  return NextResponse.json(
    { detail: message },
    { headers: noStoreHeaders(), status: 403 },
  );
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  try {
    return NextResponse.json(
      { photos: await listManagedHistoryPhotos(currentUser) },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return forbidden(error.message);
  }
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
    const photo = await createHistoryPhoto(currentUser, await request.json());
    return NextResponse.json(
      { photo },
      { headers: noStoreHeaders(), status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel cadastrar a foto historica." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
