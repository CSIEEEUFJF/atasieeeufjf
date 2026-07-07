import { NextResponse } from "next/server";

import {
  getChapterOptions,
  getCurrentUser,
  hasUsers,
  noStoreHeaders,
} from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json(
      {
        chapters: getChapterOptions(),
        setupRequired: !(await hasUsers()),
        user,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    console.error("Falha ao consultar autenticação.", error);

    return NextResponse.json(
      {
        detail:
          "Banco de dados indisponivel. Configure APP_DATABASE_URL ou POSTGRES_URL na Vercel e sincronize o schema com PRISMA_DATABASE_URL.",
      },
      { headers: noStoreHeaders(), status: 503 },
    );
  }
}
