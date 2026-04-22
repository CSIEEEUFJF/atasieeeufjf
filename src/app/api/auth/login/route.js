import { NextResponse } from "next/server";

import {
  createSession,
  hasUsers,
  isSameOriginRequest,
  setSessionCookie,
  verifyCredentials,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  if (!hasUsers()) {
    return NextResponse.json(
      { detail: "Crie o primeiro usuario antes de entrar." },
      { status: 428 },
    );
  }

  try {
    const { password, username } = await request.json();
    const user = verifyCredentials(username, password);

    if (!user) {
      return NextResponse.json(
        { detail: "Usuario ou senha invalidos." },
        { status: 401 },
      );
    }

    const session = createSession(user.id);
    const response = NextResponse.json({ user });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel entrar." },
      { status: 400 },
    );
  }
}
