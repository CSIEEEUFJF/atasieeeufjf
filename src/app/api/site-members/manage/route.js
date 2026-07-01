import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  listManageableUsers,
  noStoreHeaders,
} from "../../../../lib/auth";
import {
  createSiteMember,
  listManagedSiteMembers,
  syncSiteMembersToUsers,
} from "../../../../lib/site-members";

export const runtime = "nodejs";

function forbidden(message = "Apenas gestores podem administrar membros do site.") {
  return NextResponse.json(
    { detail: message },
    { headers: noStoreHeaders(), status: 403 },
  );
}

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticacao necessaria." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  try {
    const [members, users] = await Promise.all([
      listManagedSiteMembers(currentUser),
      listManageableUsers(currentUser),
    ]);
    return NextResponse.json(
      { members, users },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return forbidden(error.message);
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { detail: "Origem invalida." },
      { headers: noStoreHeaders(), status: 403 },
    );
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return unauthorized();
  }

  try {
    const payload = await request.json();
    if (payload?.action === "sync-users") {
      return NextResponse.json(
        await syncSiteMembersToUsers(currentUser),
        { headers: noStoreHeaders() },
      );
    }

    const member = await createSiteMember(currentUser, payload);
    return NextResponse.json(
      { member },
      { headers: noStoreHeaders(), status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível cadastrar o membro do site." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
