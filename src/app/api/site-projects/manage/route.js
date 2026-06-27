import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../lib/auth";
import {
  createSiteProject,
  listManagedSiteProjects,
} from "../../../../lib/site-projects";

export const runtime = "nodejs";

function forbidden(message = "Apenas gestores podem administrar projetos do site.") {
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
    return NextResponse.json(
      { projects: await listManagedSiteProjects(currentUser) },
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
    const project = await createSiteProject(currentUser, payload);
    return NextResponse.json(
      { project },
      { headers: noStoreHeaders(), status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível cadastrar o projeto do site." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
