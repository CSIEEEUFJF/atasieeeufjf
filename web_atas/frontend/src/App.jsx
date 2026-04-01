import { startTransition, useEffect, useRef, useState } from "react";

const FALLBACK_SOCIETIES = [
  { chave: "CS", nome: "CS - Computer Society" },
  { chave: "PES", nome: "PES - Power & Energy Society" },
  { chave: "IAS", nome: "IAS - Industry Applications Society" },
  { chave: "MTTS", nome: "MTT-S - Microwave Theory and Technology Society" },
  { chave: "RAS", nome: "RAS - Robotics and Automation Society" },
  { chave: "AESS", nome: "AESS - Aerospace and Electronic Systems Society" },
  { chave: "APS", nome: "APS - Antennas and Propagation Society" },
  { chave: "EdSoc", nome: "EdSoc - Education Society" },
  { chave: "VTS", nome: "VTS - Vehicular Technology Society" },
  { chave: "Ramo Geral", nome: "Ramo Geral IEEE" },
];

function hojeFormatado() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const ano = agora.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function splitLines(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createEmptyMember() {
  return { id: crypto.randomUUID(), nome: "", cargo: "" };
}

function createEmptyAttachment() {
  return { id: crypto.randomUUID(), legenda: "", file: null, fileName: "" };
}

function createInitialForm() {
  const hoje = hojeFormatado();
  return {
    sociedade: "CS",
    data_elaboracao: hoje,
    autor: "",
    data_reuniao: hoje,
    local_reuniao: "",
    pautasText: "",
    resultadosText: "",
    membros: [],
    anexos: [],
  };
}

function baixarArquivo(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function App() {
  const [sociedades, setSociedades] = useState(FALLBACK_SOCIETIES);
  const [form, setForm] = useState(createInitialForm);
  const [memberDraft, setMemberDraft] = useState(createEmptyMember);
  const [attachmentDraft, setAttachmentDraft] = useState(createEmptyAttachment);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({
    tone: "idle",
    text: "Preencha os campos, anexe os arquivos que quiser e gere o PDF.",
  });
  const draftInputRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadSocieties() {
      try {
        const response = await fetch("/api/sociedades");
        if (!response.ok) {
          throw new Error("Falha ao carregar sociedades.");
        }

        const payload = await response.json();
        if (active && Array.isArray(payload.sociedades) && payload.sociedades.length) {
          setSociedades(payload.sociedades);
        }
      } catch {
        if (active) {
          setSociedades(FALLBACK_SOCIETIES);
        }
      }
    }

    loadSocieties();
    return () => {
      active = false;
    };
  }, []);

  const outputName = (() => {
    const societySlug = slugify(form.sociedade || "ata");
    const dateSlug = slugify(form.data_reuniao || form.data_elaboracao || hojeFormatado());
    return `ata_${societySlug}${dateSlug ? `_${dateSlug}` : ""}`;
  })();

  const selectedSocietyName =
    sociedades.find((item) => item.chave === form.sociedade)?.nome || form.sociedade;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    startTransition(() => {
      setForm(createInitialForm());
      setMemberDraft(createEmptyMember());
      setAttachmentDraft(createEmptyAttachment());
      setEditingMemberId(null);
      setEditingAttachmentId(null);
      setStatus({
        tone: "idle",
        text: "Formulário limpo. Você pode começar outra ata.",
      });
    });
  }

  function handleMemberSave() {
    if (!memberDraft.nome.trim()) {
      setStatus({
        tone: "error",
        text: "Digite o nome do membro antes de salvar.",
      });
      return;
    }

    if (editingMemberId) {
      setForm((current) => ({
        ...current,
        membros: current.membros.map((item) =>
          item.id === editingMemberId
            ? {
                ...item,
                nome: memberDraft.nome.trim(),
                cargo: memberDraft.cargo.trim(),
              }
            : item,
        ),
      }));
      setStatus({ tone: "success", text: "Membro atualizado." });
    } else {
      setForm((current) => ({
        ...current,
        membros: [
          ...current.membros,
          {
            id: crypto.randomUUID(),
            nome: memberDraft.nome.trim(),
            cargo: memberDraft.cargo.trim(),
          },
        ],
      }));
      setStatus({ tone: "success", text: "Membro adicionado." });
    }

    setMemberDraft(createEmptyMember());
    setEditingMemberId(null);
  }

  function handleMemberEdit(memberId) {
    const member = form.membros.find((item) => item.id === memberId);
    if (!member) {
      return;
    }

    setEditingMemberId(member.id);
    setMemberDraft({ ...member });
    setStatus({ tone: "idle", text: "Membro carregado para edição." });
  }

  function handleMemberDelete(memberId) {
    setForm((current) => ({
      ...current,
      membros: current.membros.filter((item) => item.id !== memberId),
    }));

    if (editingMemberId === memberId) {
      setEditingMemberId(null);
      setMemberDraft(createEmptyMember());
    }

    setStatus({ tone: "success", text: "Membro removido." });
  }

  function handleAttachmentFile(file) {
    setAttachmentDraft((current) => ({
      ...current,
      file,
      fileName: file ? file.name : current.fileName,
    }));
  }

  function handleAttachmentSave() {
    if (!attachmentDraft.legenda.trim()) {
      setStatus({
        tone: "error",
        text: "Digite a legenda do anexo antes de salvar.",
      });
      return;
    }

    if (!attachmentDraft.file && !attachmentDraft.fileName) {
      setStatus({
        tone: "error",
        text: "Escolha um arquivo para o anexo.",
      });
      return;
    }

    if (editingAttachmentId) {
      setForm((current) => ({
        ...current,
        anexos: current.anexos.map((item) =>
          item.id === editingAttachmentId
            ? {
                ...item,
                legenda: attachmentDraft.legenda.trim(),
                file: attachmentDraft.file ?? item.file,
                fileName: attachmentDraft.fileName || item.fileName,
              }
            : item,
        ),
      }));
      setStatus({ tone: "success", text: "Anexo atualizado." });
    } else {
      setForm((current) => ({
        ...current,
        anexos: [
          ...current.anexos,
          {
            id: crypto.randomUUID(),
            legenda: attachmentDraft.legenda.trim(),
            file: attachmentDraft.file,
            fileName: attachmentDraft.fileName,
          },
        ],
      }));
      setStatus({ tone: "success", text: "Anexo adicionado." });
    }

    setAttachmentDraft(createEmptyAttachment());
    setEditingAttachmentId(null);
  }

  function handleAttachmentEdit(attachmentId) {
    const attachment = form.anexos.find((item) => item.id === attachmentId);
    if (!attachment) {
      return;
    }

    setEditingAttachmentId(attachment.id);
    setAttachmentDraft({
      ...attachment,
      file: attachment.file ?? null,
    });
    setStatus({
      tone: "idle",
      text: "Anexo carregado para edição. Se quiser trocar o arquivo, selecione outro.",
    });
  }

  function handleAttachmentDelete(attachmentId) {
    setForm((current) => ({
      ...current,
      anexos: current.anexos.filter((item) => item.id !== attachmentId),
    }));

    if (editingAttachmentId === attachmentId) {
      setEditingAttachmentId(null);
      setAttachmentDraft(createEmptyAttachment());
    }

    setStatus({ tone: "success", text: "Anexo removido." });
  }

  function validateForm() {
    const missing = [];

    if (!form.data_elaboracao.trim()) missing.push("data da elaboração");
    if (!form.autor.trim()) missing.push("autor");
    if (!form.data_reuniao.trim()) missing.push("data da reunião");
    if (!form.local_reuniao.trim()) missing.push("local da reunião");
    if (!form.membros.length) missing.push("ao menos um membro");
    if (!splitLines(form.pautasText).length) missing.push("ao menos uma pauta");
    if (!splitLines(form.resultadosText).length) missing.push("ao menos um resultado");

    if (form.anexos.some((item) => !item.file)) {
      missing.push("reenviar os arquivos dos anexos importados");
    }

    if (missing.length) {
      throw new Error(
        `Preencha ou corrija os seguintes itens:\n- ${missing.join("\n- ")}`,
      );
    }
  }

  async function handleGeneratePdf() {
    try {
      validateForm();
    } catch (error) {
      setStatus({ tone: "error", text: error.message });
      return;
    }

    setIsSubmitting(true);
    setStatus({
      tone: "loading",
      text: "Compilando a ata. Isso pode levar alguns segundos.",
    });

    const payload = {
      sociedade: form.sociedade,
      arquivo_saida: outputName,
      data_elaboracao: form.data_elaboracao,
      autor: form.autor,
      data_reuniao: form.data_reuniao,
      local_reuniao: form.local_reuniao,
      membros: form.membros.map(({ nome, cargo }) => ({ nome, cargo })),
      pautas: splitLines(form.pautasText),
      resultados: splitLines(form.resultadosText),
      anexos: form.anexos.map((item, index) => ({
        legenda: item.legenda,
        upload_key: `anexo-${index}`,
      })),
    };

    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    form.anexos.forEach((item, index) => {
      if (item.file) {
        formData.append(`anexo-${index}`, item.file, item.fileName);
      }
    });

    try {
      const response = await fetch("/api/atas/pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let detail = "Não foi possível gerar o PDF.";
        try {
          const errorPayload = await response.json();
          detail = errorPayload.detail || detail;
        } catch {
          detail = await response.text();
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const fileName =
        response.headers.get("X-Generated-Filename") || `${outputName}.pdf`;
      baixarArquivo(blob, fileName);
      setStatus({
        tone: "success",
        text: "PDF gerado com sucesso. O download foi iniciado.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível gerar o PDF.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDraftDownload() {
    const payload = {
      sociedade: form.sociedade,
      arquivo_saida: outputName,
      data_elaboracao: form.data_elaboracao,
      autor: form.autor,
      data_reuniao: form.data_reuniao,
      local_reuniao: form.local_reuniao,
      membros: form.membros.map(({ nome, cargo }) => ({ nome, cargo })),
      pautas: splitLines(form.pautasText),
      resultados: splitLines(form.resultadosText),
      anexos: form.anexos.map(({ legenda, fileName }) => ({
        legenda,
        arquivo_nome: fileName,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    baixarArquivo(blob, `${outputName}_rascunho.json`);
    setStatus({
      tone: "success",
      text: "Rascunho exportado. Se ele tiver anexos, os arquivos precisam ser reenviados ao importar.",
    });
  }

  async function handleDraftImport(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      startTransition(() => {
        setForm({
          sociedade: data.sociedade || "CS",
          data_elaboracao: data.data_elaboracao || hojeFormatado(),
          autor: data.autor || "",
          data_reuniao: data.data_reuniao || hojeFormatado(),
          local_reuniao: data.local_reuniao || "",
          pautasText: Array.isArray(data.pautas) ? data.pautas.join("\n") : "",
          resultadosText: Array.isArray(data.resultados)
            ? data.resultados.join("\n")
            : "",
          membros: Array.isArray(data.membros)
            ? data.membros.map((item) => ({
                id: crypto.randomUUID(),
                nome: item.nome || "",
                cargo: item.cargo || "",
              }))
            : [],
          anexos: Array.isArray(data.anexos)
            ? data.anexos.map((item) => ({
                id: crypto.randomUUID(),
                legenda: item.legenda || "",
                file: null,
                fileName: item.arquivo_nome || item.arquivo || "",
              }))
            : [],
        });
        setMemberDraft(createEmptyMember());
        setAttachmentDraft(createEmptyAttachment());
        setEditingMemberId(null);
        setEditingAttachmentId(null);
      });

      setStatus({
        tone: "idle",
        text: "Rascunho importado. Se houver anexos, reenvie os arquivos antes de gerar o PDF.",
      });
    } catch {
      setStatus({
        tone: "error",
        text: "Não foi possível importar o rascunho JSON.",
      });
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-cobalt" />
      <div className="ambient ambient-coral" />

      <header className="topbar">
        <div>
          <p className="eyebrow">IEEE UFJF</p>
          <h1>Atas Web</h1>
          <p className="topbar-subtitle">
            Preencha, compile e baixe o PDF sem abrir o LaTeX.
          </p>
        </div>

        <div className="topbar-actions">
          <button className="ghost-button" onClick={() => draftInputRef.current?.click()}>
            Importar rascunho
          </button>
          <button className="ghost-button" onClick={handleDraftDownload}>
            Baixar rascunho
          </button>
          <button className="ghost-button ghost-danger" onClick={resetForm}>
            Limpar tudo
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="main-column">
          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Sociedade</p>
                <h2>Escolha o template visual</h2>
              </div>
              <div className="output-pill">{selectedSocietyName}</div>
            </div>

            <div className="society-grid">
              {sociedades.map((item) => (
                <button
                  key={item.chave}
                  type="button"
                  className={`society-card ${
                    form.sociedade === item.chave ? "is-active" : ""
                  }`}
                  onClick={() => updateField("sociedade", item.chave)}
                >
                  <span className="society-card-code">{item.chave}</span>
                  <span className="society-card-name">{item.nome}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Reunião</p>
                <h2>Dados principais da ata</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Data da elaboração</span>
                <input
                  value={form.data_elaboracao}
                  onChange={(event) => updateField("data_elaboracao", event.target.value)}
                />
              </label>

              <label className="field">
                <span>Data da reunião</span>
                <input
                  value={form.data_reuniao}
                  onChange={(event) => updateField("data_reuniao", event.target.value)}
                />
              </label>

              <label className="field field-span-2">
                <span>Autor da ata</span>
                <input
                  value={form.autor}
                  onChange={(event) => updateField("autor", event.target.value)}
                />
              </label>

              <label className="field field-span-2">
                <span>Local da reunião</span>
                <input
                  value={form.local_reuniao}
                  onChange={(event) => updateField("local_reuniao", event.target.value)}
                />
              </label>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Presença</p>
                <h2>Membros presentes</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field">
                <span>Nome</span>
                <input
                  value={memberDraft.nome}
                  onChange={(event) =>
                    setMemberDraft((current) => ({
                      ...current,
                      nome: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field">
                <span>Cargo / função</span>
                <input
                  value={memberDraft.cargo}
                  onChange={(event) =>
                    setMemberDraft((current) => ({
                      ...current,
                      cargo: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="inline-actions">
              <button className="soft-button" onClick={handleMemberSave}>
                {editingMemberId ? "Salvar edição" : "Adicionar membro"}
              </button>
              <button
                className="soft-button"
                onClick={() => {
                  setMemberDraft(createEmptyMember());
                  setEditingMemberId(null);
                }}
              >
                Limpar campos
              </button>
            </div>

            <div className="list-shell">
              {form.membros.length ? (
                form.membros.map((member, index) => (
                  <div className="list-row" key={member.id}>
                    <div className="list-index">{index + 1}</div>
                    <div className="list-content">
                      <strong>{member.nome}</strong>
                      <span>{member.cargo || "Sem cargo informado"}</span>
                    </div>
                    <div className="list-actions">
                      <button
                        className="text-button"
                        onClick={() => handleMemberEdit(member.id)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => handleMemberDelete(member.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  Nenhum membro adicionado ainda.
                </div>
              )}
            </div>
          </article>

          <div className="split-panels">
            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Pautas</p>
                  <h2>Assuntos da reunião</h2>
                </div>
              </div>
              <label className="field">
                <span>Uma pauta por linha</span>
                <textarea
                  rows="12"
                  value={form.pautasText}
                  onChange={(event) => updateField("pautasText", event.target.value)}
                />
              </label>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Resultados</p>
                  <h2>Decisões e encaminhamentos</h2>
                </div>
              </div>
              <label className="field">
                <span>Um resultado por linha</span>
                <textarea
                  rows="12"
                  value={form.resultadosText}
                  onChange={(event) =>
                    updateField("resultadosText", event.target.value)
                  }
                />
              </label>
            </article>
          </div>

          <article className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Anexos</p>
                <h2>Imagens e arquivos opcionais</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field field-span-2">
                <span>Legenda</span>
                <input
                  value={attachmentDraft.legenda}
                  onChange={(event) =>
                    setAttachmentDraft((current) => ({
                      ...current,
                      legenda: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field field-span-2">
                <span>Arquivo</span>
                <input
                  type="file"
                  onChange={(event) =>
                    handleAttachmentFile(event.target.files?.[0] || null)
                  }
                />
                <small>
                  {attachmentDraft.fileName
                    ? `Selecionado: ${attachmentDraft.fileName}`
                    : "Nenhum arquivo selecionado"}
                </small>
              </label>
            </div>

            <div className="inline-actions">
              <button className="soft-button" onClick={handleAttachmentSave}>
                {editingAttachmentId ? "Salvar edição" : "Adicionar anexo"}
              </button>
              <button
                className="soft-button"
                onClick={() => {
                  setAttachmentDraft(createEmptyAttachment());
                  setEditingAttachmentId(null);
                }}
              >
                Limpar campos
              </button>
            </div>

            <div className="list-shell">
              {form.anexos.length ? (
                form.anexos.map((attachment) => (
                  <div className="list-row" key={attachment.id}>
                    <div className="list-index attachment-index">+</div>
                    <div className="list-content">
                      <strong>{attachment.legenda}</strong>
                      <span>
                        {attachment.fileName || "Arquivo precisa ser reenviado"}
                      </span>
                    </div>
                    <div className="list-actions">
                      <button
                        className="text-button"
                        onClick={() => handleAttachmentEdit(attachment.id)}
                      >
                        Editar
                      </button>
                      <button
                        className="text-button danger"
                        onClick={() => handleAttachmentDelete(attachment.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  Nenhum anexo adicionado.
                </div>
              )}
            </div>
          </article>
        </section>

        <aside className="side-column">
          <article className="panel panel-sticky">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Saída</p>
                <h2>Gerar documento</h2>
              </div>
            </div>

            <div className="summary-card">
              <span>Sociedade selecionada</span>
              <strong>{selectedSocietyName}</strong>
            </div>

            <div className="summary-card">
              <span>Nome do PDF</span>
              <strong>{outputName}.pdf</strong>
            </div>

            <div className="summary-card">
              <span>Pasta de compilação</span>
              <strong>Servidor temporário</strong>
            </div>

            <div className={`status-box tone-${status.tone}`}>
              <span>Status</span>
              <strong>{status.text}</strong>
            </div>

            <button
              className="primary-button"
              onClick={handleGeneratePdf}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Compilando..." : "Gerar PDF"}
            </button>
          </article>
        </aside>
      </main>

      <input
        ref={draftInputRef}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        onChange={handleDraftImport}
      />
    </div>
  );
}

export default App;
