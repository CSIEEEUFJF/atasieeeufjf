import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../lib/auth";
import {
  createSiteMember,
  listManagedSiteMembers,
} from "../../../../lib/site-members";

export const runtime = "nodejs";

function forbidden(message = "Apenas gestores podem administrar membros do site.") {
  return NextResponse.json({ detail: message }, { status: 403 });
}

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  try {
    return NextResponse.json({ members: await listManagedSiteMembers(currentUser) });
  } catch (error) {
    return forbidden(error.message);
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  try {
    const payload = await request.json();
    const member = await createSiteMember(currentUser, payload);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Nao foi possivel cadastrar o membro do site." },
      { status: 400 },
    );
  }
}
