import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../lib/auth";
import {
  assertForwardedPdfFile,
  assertUserCanForwardPdf,
  buildStorageMetadata,
  getForwardToken,
  getForwardUrl,
  parseMetadataValue,
  PdfForwardSecurityError,
  summarizeResponseText,
} from "../../../lib/pdf-forward-server";

export const runtime = "nodejs";

function jsonError(message, status) {
  return NextResponse.json({ detail: message, forwarded: false }, { status });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Origem invalida.", 403);
  }

  const user = await getCurrentUser();
  if (!user) {
    return jsonError("Autenticacao necessaria.", 401);
  }

  const forwardUrl = getForwardUrl().trim();
  if (!forwardUrl) {
    return NextResponse.json({
      detail: "PDF_FORWARD_URL nao configurada.",
      forwarded: false,
      skipped: true,
    });
  }

  const token = getForwardToken().trim();
  if (!token) {
    return NextResponse.json(
      {
        detail: "PDF_FORWARD_TOKEN precisa estar configurado para habilitar upload de PDF.",
        forwarded: false,
      },
      { status: 500 },
    );
  }

  let incomingForm;
  try {
    incomingForm = await request.formData();
  } catch {
    return jsonError("Envie o PDF em multipart/form-data.", 400);
  }

  const pdf = incomingForm.get("pdf");
  try {
    await assertForwardedPdfFile(pdf);
  } catch (error) {
    if (error instanceof PdfForwardSecurityError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  let metadata;
  try {
    metadata = buildStorageMetadata({
      ...parseMetadataValue(incomingForm.get("metadata")),
      fileName: pdf.name,
    });
    assertUserCanForwardPdf(user, metadata.chapter);
  } catch (error) {
    if (error instanceof PdfForwardSecurityError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  const outgoingForm = new FormData();
  outgoingForm.append("pdf", pdf, metadata.fileName);
  outgoingForm.append("metadata", JSON.stringify(metadata));
  outgoingForm.append("chapter", metadata.chapter);
  outgoingForm.append("capitulo", metadata.capitulo);
  outgoingForm.append("targetFolder", metadata.targetFolder);

  const headers = { Authorization: `Bearer ${token}` };

  try {
    const response = await fetch(forwardUrl, {
      body: outgoingForm,
      headers,
      method: "POST",
    });
    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          detail:
            summarizeResponseText(responseText)
            || `Servidor JS respondeu com status ${response.status}.`,
          forwarded: false,
          status: response.status,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      forwarded: true,
      response: summarizeResponseText(responseText),
      status: response.status,
      targetFolder: metadata.targetFolder,
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error.message || "Falha ao conectar ao servidor JS.",
        forwarded: false,
      },
      { status: 502 },
    );
  }
}
