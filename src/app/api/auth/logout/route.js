import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { detail: "Origem invalida." },
      { headers: noStoreHeaders(), status: 403 },
    );
  }

  const token = await getSessionToken();
  await destroySession(token);

  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  clearSessionCookie(response);
  return response;
}
