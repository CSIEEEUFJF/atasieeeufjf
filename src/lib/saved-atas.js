import crypto from "node:crypto";

import { normalizarNomeSaida, SOCIEDADES } from "./ata";
import { getPrisma } from "./db";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 80 * 1024 * 1024;

export class ChapterAccessError extends Error {}

function text(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getAccessibleChapters(user) {
  return Array.isArray(user?.chapters) ? user.chapters.filter((chapter) => SOCIEDADES[chapter]) : [];
}

function assertChapterAccess(user, chapterKey) {
  if (!getAccessibleChapters(user).includes(chapterKey)) {
    throw new ChapterAccessError("Voce nao tem acesso a este capitulo.");
  }
}

function limitedText(value, maxLength, fallback = "") {
  return text(value, fallback).slice(0, maxLength);
}

function listObjects(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function cleanFileName(value) {
  const cleaned = text(value, "anexo.bin")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

  return cleaned || "anexo.bin";
}

function normalizeAtaPayload(raw) {
  const form = raw?.form && typeof raw.form === "object" ? raw.form : raw;
  const sociedade = SOCIEDADES[form?.sociedade] ? form.sociedade : "CS";
  const outputName = normalizarNomeSaida(raw?.outputName || raw?.arquivo_saida || "ata_preenchida");
  const title = limitedText(raw?.title || outputName, 140, outputName);

  return {
    form: {
      anexos: listObjects(form?.anexos).map((item) => ({
        fileName: cleanFileName(item.fileName || item.arquivo_nome || item.arquivo || ""),
        id: limitedText(item.id || item.clientId || crypto.randomUUID(), 80),
        legenda: limitedText(item.legenda, 500),
      })),
      autor: limitedText(form?.autor, 180),
      data_elaboracao: limitedText(form?.data_elaboracao, 40),
      data_reuniao: limitedText(form?.data_reuniao, 40),
      local_reuniao: limitedText(form?.local_reuniao, 240),
      membros: listObjects(form?.membros).map((item) => ({
        cargo: limitedText(item.cargo, 180),
        id: limitedText(item.id || crypto.randomUUID(), 80),
        nome: limitedText(item.nome, 180),
      })),
      pautasText: text(form?.pautasText || (Array.isArray(form?.pautas) ? form.pautas.join("\n") : "")),
      resultadosText: text(
        form?.resultadosText || (Array.isArray(form?.resultados) ? form.resultados.join("\n") : ""),
      ),
      sociedade,
    },
    outputName,
    title,
  };
}

async function collectAttachments(formData, normalizedPayload) {
  const attachments = [];
  let totalBytes = 0;

  for (const [position, item] of normalizedPayload.form.anexos.entries()) {
    const file = formData?.get(`attachment:${item.id}`);
    let content = null;
    let fileName = item.fileName;
    let mimeType = "application/octet-stream";
    let size = 0;

    if (file && typeof file === "object" && typeof file.arrayBuffer === "function") {
      size = Number(file.size || 0);
      if (size > MAX_ATTACHMENT_BYTES) {
        throw new Error(`O anexo "${file.name || item.fileName}" excede 25 MB.`);
      }

      totalBytes += size;
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        throw new Error("Os anexos desta ata excedem o limite total de 80 MB.");
      }

      fileName = cleanFileName(file.name || item.fileName);
      mimeType = text(file.type, "application/octet-stream") || "application/octet-stream";
      content = Buffer.from(await file.arrayBuffer());
    }

    attachments.push({
      clientId: item.id,
      content,
      fileName,
      legenda: item.legenda,
      mimeType,
      position,
      size,
    });
  }

  return attachments;
}

export async function parseAtaSaveRequest(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const raw = await request.json();
    return {
      attachments: [],
      payload: normalizeAtaPayload(raw),
    };
  }

  const formData = await request.formData();
  const payloadRaw = formData.get("payload");

  if (typeof payloadRaw !== "string") {
    throw new Error("Payload da ata nao foi enviado.");
  }

  const payload = normalizeAtaPayload(JSON.parse(payloadRaw));
  const attachments = await collectAttachments(formData, payload);

  return { attachments, payload };
}

function attachmentCreateData(attachment) {
  return {
    clientId: attachment.clientId,
    content: attachment.content,
    fileName: attachment.fileName,
    legenda: attachment.legenda,
    mimeType: attachment.mimeType,
    position: attachment.position,
    size: attachment.size,
  };
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function summarizeAta(row) {
  return {
    attachmentCount: Number(row?._count?.attachments || 0),
    createdAt: serializeDate(row.createdAt),
    id: row.id,
    outputName: row.outputName,
    sociedade: row.sociedade,
    title: row.title,
    updatedAt: serializeDate(row.updatedAt),
  };
}

export async function listSavedAtas(user, chapterKey = "") {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return [];
  }

  const requestedChapter = text(chapterKey);
  const filteredChapters = requestedChapter ? [requestedChapter] : accessibleChapters;
  if (requestedChapter) {
    assertChapterAccess(user, requestedChapter);
  }

  const atas = await getPrisma().ata.findMany({
    include: {
      _count: {
        select: { attachments: true },
      },
    },
    orderBy: [
      { sociedade: "asc" },
      { updatedAt: "desc" },
    ],
    where: {
      sociedade: { in: filteredChapters },
    },
  });

  return atas.map(summarizeAta);
}

export async function getSavedAtaSummary(user, ataId) {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return null;
  }

  const row = await getPrisma().ata.findFirst({
    include: {
      _count: {
        select: { attachments: true },
      },
    },
    where: {
      id: ataId,
      sociedade: { in: accessibleChapters },
    },
  });

  return row ? summarizeAta(row) : null;
}

export async function createSavedAta(user, { attachments, payload }) {
  assertChapterAccess(user, payload.form.sociedade);

  const ata = await getPrisma().ata.create({
    data: {
      attachments: {
        create: attachments.map(attachmentCreateData),
      },
      outputName: payload.outputName,
      payloadJson: JSON.stringify(payload),
      sociedade: payload.form.sociedade,
      title: payload.title,
      userId: user.id,
    },
    include: {
      _count: {
        select: { attachments: true },
      },
    },
  });

  return summarizeAta(ata);
}

export async function updateSavedAta(user, ataId, { attachments, payload }) {
  assertChapterAccess(user, payload.form.sociedade);
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return null;
  }

  const ata = await getPrisma().$transaction(async (tx) => {
    const existingAta = await tx.ata.findFirst({
      select: { id: true },
      where: {
        id: ataId,
        sociedade: { in: accessibleChapters },
      },
    });

    if (!existingAta) {
      return null;
    }

    await tx.ataAttachment.deleteMany({
      where: { ataId },
    });

    return tx.ata.update({
      data: {
        attachments: {
          create: attachments.map(attachmentCreateData),
        },
        outputName: payload.outputName,
        payloadJson: JSON.stringify(payload),
        sociedade: payload.form.sociedade,
        title: payload.title,
      },
      include: {
        _count: {
          select: { attachments: true },
        },
      },
      where: { id: ataId },
    });
  });

  return ata ? summarizeAta(ata) : null;
}

export async function deleteSavedAta(user, ataId) {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return false;
  }

  const result = await getPrisma().ata.deleteMany({
    where: {
      id: ataId,
      sociedade: { in: accessibleChapters },
    },
  });

  return result.count > 0;
}

export async function getSavedAta(user, ataId) {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return null;
  }

  const ata = await getPrisma().ata.findFirst({
    include: {
      attachments: {
        orderBy: [
          { position: "asc" },
          { id: "asc" },
        ],
      },
    },
    where: {
      id: ataId,
      sociedade: { in: accessibleChapters },
    },
  });

  if (!ata) {
    return null;
  }

  const attachments = ata.attachments.map((row) => ({
    clientId: row.clientId,
    contentBase64: row.content ? Buffer.from(row.content).toString("base64") : null,
    fileName: row.fileName,
    legenda: row.legenda,
    mimeType: row.mimeType,
    size: Number(row.size || 0),
  }));

  return {
    attachments,
    createdAt: serializeDate(ata.createdAt),
    form: JSON.parse(ata.payloadJson).form,
    id: ata.id,
    outputName: ata.outputName,
    sociedade: ata.sociedade,
    title: ata.title,
    updatedAt: serializeDate(ata.updatedAt),
  };
}
