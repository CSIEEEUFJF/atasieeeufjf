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
    throw new Error(payload.detail || "Nao foi possivel preparar o envio ao servidor JS.");
  }

  return payload;
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
    ? {
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
    throw new Error(payload.detail || "Nao foi possivel enviar o PDF ao servidor JS.");
  }

  return {
    ...payload,
    forwarded: true,
    targetFolder: payload.targetFolder || session.targetFolder,
  };
}

export function formatForwardStatus(result) {
  if (result?.forwarded) {
    return result.targetFolder
      ? `PDF enviado ao servidor JS em ${result.targetFolder}.`
      : "PDF enviado ao servidor JS.";
  }

  return "Envio ao servidor JS nao configurado.";
}
