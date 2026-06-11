import { NextResponse } from "next/server";

import {
  checkAuthRateLimit,
  changeOwnPassword,
  getCurrentUser,
  isSameOriginRequest,
  rateLimitResponse,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const rateLimit = checkAuthRateLimit(request, "password");
  if (rateLimit.limited) {
    const { body, init } = rateLimitResponse(rateLimit.retryAfterSeconds);
    return NextResponse.json(body, init);
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await request.json();
    await changeOwnPassword(user.id, currentPassword, newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel alterar a senha." },
      { status: 400 },
    );
  }
}
