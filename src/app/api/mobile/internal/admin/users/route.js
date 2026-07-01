import { NextResponse } from "next/server";

import { listManageableUsers } from "../../../../../../lib/auth";
import { getMobileSessionUser } from "../../../../../../lib/mobile-session";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao pelo sistema interno necessaria." }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ detail: "Acesso restrito aos administradores." }, { status: 403 });
}

export async function GET(request) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }
  if (!user.isAdmin) {
    return forbidden();
  }

  const users = await listManageableUsers(user);
  return NextResponse.json({
    users: users.map((item) => ({
      ...item,
      hasStoredSuperAdmin: false,
      isSuperAdmin: item.email === "rafael.nick@computer.org",
      requestedChapterRoles: item.chapterRoles || {},
      uid: String(item.id),
    })),
  });
}
