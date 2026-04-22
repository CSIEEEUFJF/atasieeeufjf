import { NextResponse } from "next/server";

import { getChapterOptions, getCurrentUser, hasUsers } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json({
      chapters: getChapterOptions(),
      setupRequired: !(await hasUsers()),
      user,
    });
  } catch (error) {
    console.error("Falha ao consultar autenticacao.", error);

    return NextResponse.json(
      {
        detail:
          "Banco de dados indisponivel. Configure DATABASE_URL na Vercel e aplique as migrations do Prisma.",
      },
      { status: 503 },
    );
  }
}
