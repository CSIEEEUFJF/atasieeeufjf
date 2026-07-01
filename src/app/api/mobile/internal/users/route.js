import { NextResponse } from "next/server";

import { listVisibleUsers, syncUsersToFirebase } from "../../../../../lib/auth";
import { getFirebaseMobileUser } from "../../../../../lib/firebase-mobile-auth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao Firebase necessaria." }, { status: 401 });
}

export async function GET(request) {
  const user = await getFirebaseMobileUser(request);
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  await syncUsersToFirebase();
  return NextResponse.json({
    users: await listVisibleUsers(user, searchParams.get("chapter") || ""),
  });
}
