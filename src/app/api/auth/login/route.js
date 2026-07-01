import { NextResponse } from "next/server";

import {
  AuthSecurityError,
  checkAuthRateLimit,
  createSession,
  hasUsers,
  isSameOriginRequest,
  noStoreHeaders,
  rateLimitResponse,
  setSessionCookie,
  verifyCredentials,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { detail: "Origem invalida." },
        { headers: noStoreHeaders(), status: 403 },
      );
    }

    const rateLimit = checkAuthRateLimit(request, "login");
    if (rateLimit.limited) {
      const { body, init } = rateLimitResponse(rateLimit.retryAfterSeconds);
      return NextResponse.json(body, init);
    }

    if (!(await hasUsers())) {
      return NextResponse.json(
        { detail: "Crie o primeiro usuário antes de entrar." },
        { headers: noStoreHeaders(), status: 428 },
      );
    }

    const { password, username } = await request.json();
    const user = await verifyCredentials(username, password);

    if (!user) {
      return NextResponse.json(
        { detail: "Usuário ou senha inválidos." },
        { headers: noStoreHeaders(), status: 401 },
      );
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({ user }, { headers: noStoreHeaders() });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof AuthSecurityError) {
      return NextResponse.json(
        { detail: error.message },
        {
          headers: noStoreHeaders(
            error.retryAfterSeconds
              ?{ "Retry-After": String(error.retryAfterSeconds) }
              : {},
          ),
          status: error.status,
        },
      );
    }

    const message = error.message || "Não foi possível entrar.";
    const status = message.includes("DATABASE_URL") ? 503 : 400;
    return NextResponse.json(
      { detail: message },
      { headers: noStoreHeaders(), status },
    );
  }
}
