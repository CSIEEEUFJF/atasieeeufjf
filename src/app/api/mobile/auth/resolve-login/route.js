import { NextResponse } from "next/server";

import { getPrisma } from "../../../../../lib/db";

export const runtime = "nodejs";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".");
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const identifier = String(searchParams.get("identifier") || "").trim();

  if (!identifier) {
    return NextResponse.json(
      { detail: "Informe o e-mail ou usuário." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const email = normalizeEmail(identifier);
  const username = normalizeUsername(identifier);
  const user = await getPrisma().user.findFirst({
    select: { email: true },
    where: {
      OR: [
        { email },
        { username },
      ],
    },
  });

  if (!user?.email) {
    return NextResponse.json(
      { detail: "Usuário não encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { email: normalizeEmail(user.email) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
