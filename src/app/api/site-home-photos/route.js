import { NextResponse } from "next/server";

import { noStoreHeaders } from "../../../lib/auth";
import { listPublicHomePhotos } from "../../../lib/site-home-photos";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      { photos: await listPublicHomePhotos() },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível carregar fotos da página inicial." },
      { headers: noStoreHeaders(), status: 500 },
    );
  }
}
