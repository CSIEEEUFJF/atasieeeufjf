import { NextResponse } from "next/server";

import {
  buildStorageMetadata,
  createUploadToken,
  getForwardToken,
  getForwardUrl,
} from "../../../../lib/pdf-forward-server";

export const runtime = "nodejs";

export async function POST(request) {
  const forwardUrl = getForwardUrl().trim();
  if (!forwardUrl) {
    return NextResponse.json({
      detail: "PDF_FORWARD_URL não configurada.",
      forwarded: false,
      skipped: true,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Envie os metadados do PDF em JSON." },
      { status: 400 },
    );
  }

  const metadata = buildStorageMetadata(body?.metadata || {});
  const uploadToken = createUploadToken(metadata);
  const staticTokenConfigured = Boolean(getForwardToken().trim());

  if (staticTokenConfigured && !uploadToken) {
    return NextResponse.json(
      { detail: "Não foi possível criar o token temporário de upload." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    authorization: uploadToken ?`Bearer ${uploadToken}` : "",
    directUpload: true,
    metadata,
    targetFolder: metadata.targetFolder,
    uploadUrl: forwardUrl,
  });
}
