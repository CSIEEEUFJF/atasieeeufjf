import { NextResponse } from "next/server";

import {
  createSession,
  createUser,
  hasUsers,
  isSameOriginRequest,
  setSessionCookie,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  if (hasUsers()) {
    return NextResponse.json(
      { detail: "A configuracao inicial ja foi concluida." },
      { status: 409 },
    );
  }

  try {
    const payload = await request.json();
    const user = createUser(payload, { isAdmin: true });
    const session = createSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel criar o usuario inicial." },
      { status: 400 },
    );
  }
}
