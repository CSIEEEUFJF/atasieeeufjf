import { NextResponse } from "next/server";

import { importDoorProfiles, listDoorProfiles } from "../../../../../lib/door-profiles";
import { getMobileSessionUser } from "../../../../../lib/mobile-session";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao pelo sistema interno necessaria." }, { status: 401 });
}

export async function GET(request) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ profiles: await listDoorProfiles() });
}

export async function POST(request) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!user.isAdmin && user.email !== "rafael.nick@computer.org") {
    return NextResponse.json({ detail: "Acesso restrito aos administradores." }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const report = await importDoorProfiles(payload.rawJson || payload.users || payload.profiles || payload);
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível importar usuários da porta." },
      { status: 400 },
    );
  }
}
