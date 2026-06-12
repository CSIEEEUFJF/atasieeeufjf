import { NextResponse } from "next/server";

import {
  buildStorageMetadata,
  getForwardToken,
  getForwardUrl,
  parseMetadataValue,
  summarizeResponseText,
} from "../../../lib/pdf-forward-server";

export const runtime = "nodejs";

export async function POST(request) {
  const forwardUrl = getForwardUrl().trim();
  if (!forwardUrl) {
    return NextResponse.json({
      detail: "PDF_FORWARD_URL nao configurada.",
      forwarded: false,
      skipped: true,
    });
  }

  let incomingForm;
  try {
    incomingForm = await request.formData();
  } catch {
    return NextResponse.json(
      { detail: "Envie o PDF em multipart/form-data." },
      { status: 400 },
    );
  }

  const pdf = incomingForm.get("pdf");
  if (!pdf || typeof pdf.arrayBuffer !== "function") {
    return NextResponse.json(
      { detail: "Arquivo PDF nao enviado." },
      { status: 400 },
    );
  }

  const metadata = buildStorageMetadata(parseMetadataValue(incomingForm.get("metadata")));
  const fileName = String(metadata.fileName || pdf.name || "ata.pdf");
  const outgoingForm = new FormData();
  outgoingForm.append("pdf", pdf, fileName);
  outgoingForm.append("metadata", JSON.stringify(metadata));
  outgoingForm.append("chapter", metadata.chapter);
  outgoingForm.append("capitulo", metadata.capitulo);
  outgoingForm.append("targetFolder", metadata.targetFolder);

  const token = getForwardToken().trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

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
