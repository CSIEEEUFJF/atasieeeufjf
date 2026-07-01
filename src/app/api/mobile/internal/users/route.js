import { NextResponse } from "next/server";

import { listVisibleUsers } from "../../../../../lib/auth";
import { getMobileSessionUser } from "../../../../../lib/mobile-session";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao pelo sistema interno necessaria." }, { status: 401 });
}

function absolutizeUserPhoto(user, request) {
  const photoUrl = String(user.profilePictureUrl || "");
  return {
    ...user,
    profilePictureUrl: photoUrl.startsWith("/")
      ?new URL(photoUrl, request.url).toString()
      : photoUrl,
  };
}

export async function GET(request) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const users = await listVisibleUsers(user, searchParams.get("chapter") || "");
  return NextResponse.json({
    users: users.map((item) => absolutizeUserPhoto(item, request)),
  });
}
