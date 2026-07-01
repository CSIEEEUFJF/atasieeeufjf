import { NextResponse } from "next/server";

import { getMobileSessionUser } from "../../../../../lib/mobile-session";
import {
  createInternalEvent,
  InternalAccessError,
  listInternalEvents,
} from "../../../../../lib/internal";

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
      events: await listInternalEvents(user, searchParams.get("chapter") || ""),
    });
  } catch (error) {
    if (error instanceof InternalAccessError) {
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
    const events = await createInternalEvent(user, await request.json());
    return NextResponse.json({ events }, { status: 201 });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível salvar o evento." },
      { status: 400 },
    );
  }
}
