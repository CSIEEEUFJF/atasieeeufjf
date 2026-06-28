import { NextResponse } from "next/server";

import { listPublicHistoryPhotos } from "../../../lib/site-history-photos";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
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
      { photos: await listPublicHistoryPhotos() },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Falha ao listar fotos historicas publicas.", error);

    return NextResponse.json(
      { detail: "Nao foi possivel carregar fotos historicas." },
      { headers: corsHeaders, status: 503 },
    );
  }
}
