import crypto from "node:crypto";

import { normalizarNomeSaida, SOCIEDADES } from "./ata";
import { getDb, nowIso } from "./db";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 80 * 1024 * 1024;

export class ChapterAccessError extends Error {}

function text(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getAccessibleChapters(user) {
  return Array.isArray(user?.chapters) ? user.chapters.filter((chapter) => SOCIEDADES[chapter]) : [];
}

function placeholders(values) {
  return values.map(() => "?").join(", ");
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

function insertAttachments(db, ataId, attachments) {
  const insertAttachment = db.prepare(`
    INSERT INTO ata_attachments (
      ata_id, client_id, legenda, file_name, mime_type, size, content, position
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const attachment of attachments) {
    insertAttachment.run(
      ataId,
      attachment.clientId,
      attachment.legenda,
      attachment.fileName,
      attachment.mimeType,
      attachment.size,
      attachment.content,
      attachment.position,
    );
  }
}

export function listSavedAtas(user, chapterKey = "") {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return [];
  }

  const requestedChapter = text(chapterKey);
  const filteredChapters = requestedChapter ? [requestedChapter] : accessibleChapters;
  if (requestedChapter) {
    assertChapterAccess(user, requestedChapter);
  }

  return getDb()
    .prepare(`
      SELECT
        atas.id,
        atas.title,
        atas.sociedade,
        atas.output_name AS outputName,
        atas.created_at AS createdAt,
        atas.updated_at AS updatedAt,
        COUNT(ata_attachments.id) AS attachmentCount
      FROM atas
      LEFT JOIN ata_attachments ON ata_attachments.ata_id = atas.id
      WHERE atas.sociedade IN (${placeholders(filteredChapters)})
      GROUP BY atas.id
      ORDER BY atas.sociedade COLLATE NOCASE ASC, atas.updated_at DESC
    `)
    .all(...filteredChapters)
    .map((row) => ({
      ...row,
      attachmentCount: Number(row.attachmentCount || 0),
    }));
}

export function getSavedAtaSummary(user, ataId) {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return null;
  }

  const row = getDb()
    .prepare(`
      SELECT
        atas.id,
        atas.title,
        atas.sociedade,
        atas.output_name AS outputName,
        atas.created_at AS createdAt,
        atas.updated_at AS updatedAt,
        COUNT(ata_attachments.id) AS attachmentCount
      FROM atas
      LEFT JOIN ata_attachments ON ata_attachments.ata_id = atas.id
      WHERE atas.id = ? AND atas.sociedade IN (${placeholders(accessibleChapters)})
      GROUP BY atas.id
    `)
    .get(ataId, ...accessibleChapters);

  return row
    ? {
        ...row,
        attachmentCount: Number(row.attachmentCount || 0),
      }
    : null;
}

export function createSavedAta(user, { attachments, payload }) {
  assertChapterAccess(user, payload.form.sociedade);
  const db = getDb();
  const transaction = db.transaction(() => {
    const timestamp = nowIso();
    const result = db
      .prepare(`
        INSERT INTO atas (
          user_id, title, sociedade, output_name, payload_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        user.id,
        payload.title,
        payload.form.sociedade,
        payload.outputName,
        JSON.stringify(payload),
        timestamp,
        timestamp,
      );

    const ataId = Number(result.lastInsertRowid);
    insertAttachments(db, ataId, attachments);
    return ataId;
  });

  return getSavedAtaSummary(user, transaction());
}

export function updateSavedAta(user, ataId, { attachments, payload }) {
  assertChapterAccess(user, payload.form.sociedade);
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return null;
  }

  const db = getDb();
  const transaction = db.transaction(() => {
    const timestamp = nowIso();
    const result = db
      .prepare(`
        UPDATE atas
        SET title = ?, sociedade = ?, output_name = ?, payload_json = ?, updated_at = ?
        WHERE id = ? AND sociedade IN (${placeholders(accessibleChapters)})
      `)
      .run(
        payload.title,
        payload.form.sociedade,
        payload.outputName,
        JSON.stringify(payload),
        timestamp,
        ataId,
        ...accessibleChapters,
      );

    if (result.changes === 0) {
      return false;
    }

    db.prepare("DELETE FROM ata_attachments WHERE ata_id = ?").run(ataId);
    insertAttachments(db, ataId, attachments);
    return true;
  });

  return transaction() ? getSavedAtaSummary(user, ataId) : null;
}

export function deleteSavedAta(user, ataId) {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return false;
  }

  const result = getDb()
    .prepare(`DELETE FROM atas WHERE id = ? AND sociedade IN (${placeholders(accessibleChapters)})`)
    .run(ataId, ...accessibleChapters);

  return result.changes > 0;
}

export function getSavedAta(user, ataId) {
  const accessibleChapters = getAccessibleChapters(user);
  if (!accessibleChapters.length) {
    return null;
  }

  const db = getDb();
  const ata = db
    .prepare(`
      SELECT
        id,
        title,
        sociedade,
        output_name AS outputName,
        payload_json AS payloadJson,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM atas
      WHERE id = ? AND sociedade IN (${placeholders(accessibleChapters)})
    `)
    .get(ataId, ...accessibleChapters);

  if (!ata) {
    return null;
  }

  const attachments = db
    .prepare(`
      SELECT client_id AS clientId, legenda, file_name AS fileName, mime_type AS mimeType,
        size, content, position
      FROM ata_attachments
      WHERE ata_id = ?
      ORDER BY position ASC, id ASC
    `)
    .all(ata.id)
    .map((row) => ({
      clientId: row.clientId,
      contentBase64: row.content ? Buffer.from(row.content).toString("base64") : null,
      fileName: row.fileName,
      legenda: row.legenda,
      mimeType: row.mimeType,
      size: Number(row.size || 0),
    }));

  return {
    attachments,
    createdAt: ata.createdAt,
    form: JSON.parse(ata.payloadJson).form,
    id: ata.id,
    outputName: ata.outputName,
    sociedade: ata.sociedade,
    title: ata.title,
    updatedAt: ata.updatedAt,
  };
}
