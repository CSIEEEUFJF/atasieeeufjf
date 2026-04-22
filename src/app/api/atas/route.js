import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../lib/auth";
import {
  ChapterAccessError,
  createSavedAta,
  listSavedAtas,
  parseAtaSaveRequest,
} from "../../../lib/saved-atas";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      atas: await listSavedAtas(user, searchParams.get("capitulo") || ""),
    });
  } catch (error) {
    if (error instanceof ChapterAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    throw error;
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const parsed = await parseAtaSaveRequest(request);
    const ata = await createSavedAta(user, parsed);
    return NextResponse.json({ ata }, { status: 201 });
  } catch (error) {
    if (error instanceof ChapterAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Nao foi possivel salvar a ata." },
      { status: 400 },
    );
  }
}
