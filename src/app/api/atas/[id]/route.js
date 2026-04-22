import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../lib/auth";
import {
  ChapterAccessError,
  deleteSavedAta,
  getSavedAta,
  parseAtaSaveRequest,
  updateSavedAta,
} from "../../../../lib/saved-atas";

export const runtime = "nodejs";

function parseId(value) {
  const id = Number.parseInt(String(value || ""), 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

async function getRouteContext(context) {
  const params = await context.params;
  const id = parseId(params.id);
  const user = await getCurrentUser();

  if (!user) {
    return { response: unauthorized() };
  }

  if (!id) {
    return {
      response: NextResponse.json({ detail: "Ata invalida." }, { status: 400 }),
    };
  }

  return { id, user };
}

export async function GET(_request, context) {
  const routeContext = await getRouteContext(context);
  if (routeContext.response) {
    return routeContext.response;
  }

  const ata = getSavedAta(routeContext.user, routeContext.id);
  if (!ata) {
    return NextResponse.json({ detail: "Ata nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ata });
}

export async function PUT(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const routeContext = await getRouteContext(context);
  if (routeContext.response) {
    return routeContext.response;
  }

  try {
    const parsed = await parseAtaSaveRequest(request);
    const ata = updateSavedAta(routeContext.user, routeContext.id, parsed);

    if (!ata) {
      return NextResponse.json({ detail: "Ata nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ata });
  } catch (error) {
    if (error instanceof ChapterAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Nao foi possivel atualizar a ata." },
      { status: 400 },
    );
  }
}

export async function DELETE(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem invalida." }, { status: 403 });
  }

  const routeContext = await getRouteContext(context);
  if (routeContext.response) {
    return routeContext.response;
  }

  const deleted = deleteSavedAta(routeContext.user, routeContext.id);
  if (!deleted) {
    return NextResponse.json({ detail: "Ata nao encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
