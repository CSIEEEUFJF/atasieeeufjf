import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../lib/auth";
import {
  assertUserCanForwardPdf,
  buildStorageMetadata,
  createUploadToken,
  getForwardToken,
  getForwardUrl,
  PdfForwardSecurityError,
} from "../../../../lib/pdf-forward-server";

export const runtime = "nodejs";

function jsonError(message, status) {
  return NextResponse.json({ detail: message }, { status });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Origem inválida.", 403);
  }

  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Autenticação necessária.", 401);
  }

  const forwardUrl = getForwardUrl().trim();
  if (!forwardUrl) {
    return NextResponse.json({
      detail: "PDF_FORWARD_URL não configurada.",
      forwarded: false,
      skipped: true,
    });
  }

  if (!getForwardToken().trim()) {
    return NextResponse.json(
      { detail: "PDF_FORWARD_TOKEN precisa estar configurado para habilitar upload de PDF." },
      { status: 500 },
    );
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

  let metadata;
  try {
    metadata = buildStorageMetadata(body?.metadata || {});
    assertUserCanForwardPdf(user, metadata.chapter);
  } catch (error) {
    if (error instanceof PdfForwardSecurityError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  const uploadToken = createUploadToken(metadata);
  if (!uploadToken) {
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
