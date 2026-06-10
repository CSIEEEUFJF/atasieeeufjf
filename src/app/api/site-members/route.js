import { NextResponse } from "next/server";

import { listPublicSiteMembers } from "../../../lib/auth";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: corsHeaders,
    status: 204,
  });
}

export async function GET() {
  try {
    return NextResponse.json(
      { members: await listPublicSiteMembers() },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Falha ao listar membros publicos.", error);

    return NextResponse.json(
      { detail: "Nao foi possivel carregar membros publicos." },
      { headers: corsHeaders, status: 503 },
    );
  }
}
