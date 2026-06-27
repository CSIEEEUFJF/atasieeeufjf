import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../lib/auth";
import {
  createHomePhoto,
  listManagedHomePhotos,
} from "../../../../lib/site-home-photos";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticação necessária." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  try {
    return NextResponse.json(
      { photos: await listManagedHomePhotos(currentUser) },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível carregar fotos." },
      { headers: noStoreHeaders(), status: 403 },
    );
  }
}

export async function POST(request) {
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

  try {
    const photo = await createHomePhoto(currentUser, await request.json());
    return NextResponse.json(
      { photo },
      { headers: noStoreHeaders(), status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível cadastrar a foto." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
