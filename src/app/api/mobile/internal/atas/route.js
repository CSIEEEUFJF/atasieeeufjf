import { NextResponse } from "next/server";

import { getMobileSessionUser } from "../../../../../lib/mobile-session";
import {
  ChapterAccessError,
  createSavedAta,
  listSavedAtas,
  parseAtaSaveRequest,
} from "../../../../../lib/saved-atas";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao pelo sistema interno necessaria." }, { status: 401 });
}

export async function GET(request) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      atas: await listSavedAtas(user, searchParams.get("capitulo") || searchParams.get("chapter") || ""),
    });
  } catch (error) {
    if (error instanceof ChapterAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    throw error;
  }
}

export async function POST(request) {
  const user = await getMobileSessionUser(request);
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
      { detail: error.message || "Não foi possível salvar a ata." },
      { status: 400 },
    );
  }
}
