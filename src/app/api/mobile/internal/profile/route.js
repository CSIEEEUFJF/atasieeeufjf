import { NextResponse } from "next/server";

import { updateOwnMobileProfile } from "../../../../../lib/auth";
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

  return NextResponse.json({ user: absolutizeUserPhoto(user, request) });
}

export async function PATCH(request) {
  const user = await getMobileSessionUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const updatedUser = await updateOwnMobileProfile(user, await request.json());
    return NextResponse.json({ user: absolutizeUserPhoto(updatedUser, request) });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível atualizar o perfil." },
      { status: 400 },
    );
  }
}
