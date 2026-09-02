async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

const FORWARD_SESSION_TIMEOUT_MS = 15_000;
const FORWARD_UPLOAD_TIMEOUT_MS = 120_000;

async function fetchJsonWithTimeout(url, options, timeoutMs, timeoutMessage) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await readJson(response);

    if (controller.signal.aborted) {
      throw new Error(timeoutMessage);
    }

    return { payload, response };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(timeoutMessage);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function createForwardSession(metadata) {
  const { payload, response } = await fetchJsonWithTimeout(
    "/api/pdf-forward/session",
    {
      body: JSON.stringify({ metadata }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    FORWARD_SESSION_TIMEOUT_MS,
    "O servidor demorou mais de 15 segundos para preparar o envio do PDF.",
  );

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

  const { payload, response } = await fetchJsonWithTimeout(
    session.uploadUrl,
    {
      body: formData,
      headers,
      method: "POST",
    },
    FORWARD_UPLOAD_TIMEOUT_MS,
    "O envio do PDF excedeu o limite de 2 minutos e foi cancelado.",
  );

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
