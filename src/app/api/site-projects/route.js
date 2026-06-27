import { NextResponse } from "next/server";

import { listPublicSiteProjects } from "../../../lib/site-projects";

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
      { projects: await listPublicSiteProjects() },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("Falha ao listar projetos públicos.", error);

    return NextResponse.json(
      { detail: "Não foi possível carregar projetos públicos." },
      { headers: corsHeaders, status: 503 },
    );
  }
}
