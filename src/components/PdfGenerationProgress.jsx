"use client";

import { useEffect, useState } from "react";

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatSeconds(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}min ${remainder}s` : `${minutes}min`;
}

function estimatePdfGenerationSeconds(form) {
  const attachments = Array.isArray(form?.anexos) ? form.anexos : [];
  const attachmentMegabytes = attachments.reduce((total, attachment) => {
    const size = Number(attachment.file?.size || attachment.size || 0);
    return total + (Number.isFinite(size) && size > 0 ? size / 1024 / 1024 : 0);
  }, 0);
  const members = Array.isArray(form?.membros) ? form.membros.length : 0;
  const textLines = splitLines(form?.pautasText).length + splitLines(form?.resultadosText).length;

  return clamp(
    Math.ceil(16 + attachments.length * 5 + attachmentMegabytes * 2 + members * 0.5 + textLines * 0.8),
    12,
    90,
  );
}

function createInitialSnapshot() {
  return {
    elapsedSeconds: 0,
    estimateSeconds: 20,
    percent: 5,
    remainingSeconds: 20,
  };
}

export default function PdfGenerationProgress({ active, form, label = "Gerando PDF" }) {
  const [snapshot, setSnapshot] = useState(createInitialSnapshot);

  useEffect(() => {
    if (!active) {
      setSnapshot(createInitialSnapshot());
      return undefined;
    }

    const startedAt = Date.now();
    const estimateSeconds = estimatePdfGenerationSeconds(form);

    function updateSnapshot() {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const rawPercent = Math.round((elapsedSeconds / estimateSeconds) * 100);
      const percent = clamp(rawPercent, 5, 95);
      const remainingSeconds = Math.max(0, estimateSeconds - elapsedSeconds);

      setSnapshot({
        elapsedSeconds,
        estimateSeconds,
        percent,
        remainingSeconds,
      });
    }

    updateSnapshot();
    const intervalId = window.setInterval(updateSnapshot, 300);
    return () => window.clearInterval(intervalId);
  }, [active]);

  if (!active) {
    return null;
  }

  const remainingLabel = snapshot.remainingSeconds
    ? `~${formatSeconds(snapshot.remainingSeconds)} restantes`
    : "Finalizando...";

  return (
    <div className="pdf-progress" role="status" aria-live="polite">
      <div className="pdf-progress-header">
        <strong>{label}</strong>
        <span>{snapshot.percent}%</span>
      </div>
      <div className="pdf-progress-track" aria-hidden="true">
        <span style={{ width: `${snapshot.percent}%` }} />
      </div>
      <div className="pdf-progress-meta">
        <span>Tempo estimado: ~{formatSeconds(snapshot.estimateSeconds)}</span>
        <span>{remainingLabel}</span>
      </div>
    </div>
  );
}
