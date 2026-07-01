import { NextResponse } from "next/server";

import { listVisibleUsers } from "../../../../../lib/auth";
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

  const { searchParams } = new URL(request.url);
  return NextResponse.json({
    users: await listVisibleUsers(user, searchParams.get("chapter") || ""),
  });
}
