import { NextResponse } from "next/server";

import {
  getCurrentUser,
  isSameOriginRequest,
  noStoreHeaders,
} from "../../../../../lib/auth";
import {
  deleteSiteProject,
  updateSiteProject,
} from "../../../../../lib/site-projects";

export const runtime = "nodejs";

function parseId(value) {
  const id = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function unauthorized() {
  return NextResponse.json(
    { detail: "Autenticacao necessaria." },
    { headers: noStoreHeaders(), status: 401 },
  );
}

export async function PATCH(request, context) {
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

  const params = await context.params;
  const projectId = parseId(params.id);
  if (!projectId) {
    return NextResponse.json(
      { detail: "Projeto inválido." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  try {
    const payload = await request.json();
    const project = await updateSiteProject(currentUser, projectId, payload);
    return NextResponse.json({ project }, { headers: noStoreHeaders() });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível atualizar o projeto do site." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}

export async function DELETE(request, context) {
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

  const params = await context.params;
  const projectId = parseId(params.id);
  if (!projectId) {
    return NextResponse.json(
      { detail: "Projeto inválido." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await deleteSiteProject(currentUser, projectId),
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível remover o projeto do site." },
      { headers: noStoreHeaders(), status: 400 },
    );
  }
}
