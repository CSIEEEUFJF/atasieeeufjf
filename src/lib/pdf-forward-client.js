async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function forwardGeneratedPdf({ fileName, metadata = {}, pdf }) {
  const formData = new FormData();
  formData.append("pdf", pdf, fileName);
  formData.append("metadata", JSON.stringify(metadata));

  const response = await fetch("/api/pdf-forward", {
    body: formData,
    method: "POST",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload.detail || "Nao foi possivel enviar o PDF ao servidor JS.");
  }

  return payload;
}

export function formatForwardStatus(result) {
  if (result?.forwarded) {
    return result.targetFolder
      ? `PDF enviado ao servidor JS em ${result.targetFolder}.`
      : "PDF enviado ao servidor JS.";
  }

  return "Envio ao servidor JS nao configurado.";
}
