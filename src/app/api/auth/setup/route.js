import { NextResponse } from "next/server";

import {
  checkAuthRateLimit,
  createSession,
  createUser,
  hasUsers,
  isSameOriginRequest,
  noStoreHeaders,
  rateLimitResponse,
  setSessionCookie,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { detail: "Origem invalida." },
      { headers: noStoreHeaders(), status: 403 },
    );
  }

  const rateLimit = checkAuthRateLimit(request, "setup");
  if (rateLimit.limited) {
    const { body, init } = rateLimitResponse(rateLimit.retryAfterSeconds);
    return NextResponse.json(body, init);
  }

  if (await hasUsers()) {
    return NextResponse.json(
      { detail: "A configuração inicial já foi concluída." },
      { headers: noStoreHeaders(), status: 409 },
    );
  }

  try {
    const payload = await request.json();
    const user = await createUser(payload, { isAdmin: true });
    const session = await createSession(user.id);
    const response = NextResponse.json(
      { user },
      { headers: noStoreHeaders(), status: 201 },
    );
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível criar o usuário inicial." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
