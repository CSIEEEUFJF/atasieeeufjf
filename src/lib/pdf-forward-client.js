async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function createForwardSession(metadata) {
  const response = await fetch("/api/pdf-forward/session", {
    body: JSON.stringify({ metadata }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload.detail || "Não foi possível preparar o envio ao servidor JS.");
  }

  return payload;
}

export function buildPdfFileNameFromTitle(title, fallbackFileName = "ata.pdf") {
  const fallbackStem = String(fallbackFileName || "ata.pdf").replace(/\.pdf$/i, "");
  const stem = String(title || fallbackStem)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^0-9A-Za-z._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return `${stem || "ata"}.pdf`;
}

export async function forwardGeneratedPdf({ fileName, metadata = {}, pdf }) {
  const session = await createForwardSession({
    ...metadata,
    fileName: metadata.fileName || fileName,
  });

  if (session?.skipped) {
    return session;
  }

  const formData = new FormData();
  formData.append("pdf", pdf, fileName);
  formData.append("metadata", JSON.stringify(session.metadata || metadata));

  if (session.metadata?.chapter) {
    formData.append("chapter", session.metadata.chapter);
  }

  if (session.metadata?.capitulo) {
    formData.append("capitulo", session.metadata.capitulo);
  }

  if (session.metadata?.targetFolder) {
    formData.append("targetFolder", session.metadata.targetFolder);
  }

  const headers = session.authorization
    ?{
        Authorization: session.authorization,
      }
    : undefined;

  const response = await fetch(session.uploadUrl, {
    body: formData,
    headers,
    method: "POST",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload.detail || "Não foi possível enviar o PDF ao servidor JS.");
  }

  return {
    ...payload,
    forwarded: true,
    targetFolder: payload.targetFolder || session.targetFolder,
  };
}

export function formatForwardStatus(result) {
  if (result?.duplicate && result?.updated) {
    return result.fileName
      ?`PDF existente atualizado no servidor como ${result.fileName}.`
      : "PDF existente atualizado no servidor.";
  }

  if (result?.duplicate) {
    return result.fileName
      ?`PDF já existia no servidor como ${result.fileName}.`
      : "PDF já existia no servidor.";
  }

  if (result?.forwarded) {
    return result.targetFolder
      ?`PDF enviado ao servidor JS em ${result.targetFolder}.`
      : "PDF enviado ao servidor JS.";
  }

  return "Envio ao servidor JS não configurado.";
}
