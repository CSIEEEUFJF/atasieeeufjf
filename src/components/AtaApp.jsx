"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import {
  compileAtaPdfInBrowser,
  preloadSwiftLatexForSociety,
} from "../lib/swiftlatex-client";
import PdfGenerationProgress from "./PdfGenerationProgress";
import UserPasswordDialog from "./UserPasswordDialog";

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
    titulo: "",
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

function createInitialAuthForm() {
  return {
    name: "",
    password: "",
    username: "",
  };
}

function createStoredAtaPayload(form, outputName) {
  const title = String(form.titulo || "").trim() || outputName;

  return {
    form: {
      anexos: form.anexos.map(({ file, fileName, id, legenda, mimeType, size }) => ({
        fileName: fileName || file?.name || "",
        id,
        legenda,
        mimeType: file?.type || mimeType || "",
        size: Number(file?.size || size || 0),
      })),
      autor: form.autor,
      data_elaboracao: form.data_elaboracao,
      data_reuniao: form.data_reuniao,
      local_reuniao: form.local_reuniao,
      membros: form.membros.map(({ cargo, id, nome }) => ({ cargo, id, nome })),
      pautasText: form.pautasText,
      resultadosText: form.resultadosText,
      sociedade: form.sociedade,
      titulo: title,
    },
    outputName,
    title,
  };
}

function createFormFromStoredAta(ata) {
  const savedForm = ata.form || {};
  const attachmentsById = new Map(
    (ata.attachments || []).map((attachment) => [attachment.clientId, attachment]),
  );
  const attachmentMetadata = Array.isArray(savedForm.anexos) && savedForm.anexos.length
    ? savedForm.anexos
    : (ata.attachments || []).map((attachment) => ({
        fileName: attachment.fileName,
        id: attachment.clientId,
        legenda: attachment.legenda,
      }));

  return {
    anexos: attachmentMetadata.map((item) => {
      const id = item.id || crypto.randomUUID();
      const storedAttachment = attachmentsById.get(id);
      const fileName = storedAttachment?.fileName || item.fileName || "";

      return {
        file: null,
        fileName,
        id,
        legenda: item.legenda || storedAttachment?.legenda || "",
        mimeType: storedAttachment?.mimeType || item.mimeType || "",
        size: Number(storedAttachment?.size || item.size || 0),
      };
    }),
    autor: savedForm.autor || "",
    data_elaboracao: savedForm.data_elaboracao || hojeFormatado(),
    data_reuniao: savedForm.data_reuniao || hojeFormatado(),
    local_reuniao: savedForm.local_reuniao || "",
    membros: Array.isArray(savedForm.membros)
      ? savedForm.membros.map((item) => ({
          cargo: item.cargo || "",
          id: item.id || crypto.randomUUID(),
          nome: item.nome || "",
        }))
      : [],
    pautasText: savedForm.pautasText || "",
    resultadosText: savedForm.resultadosText || "",
    sociedade: savedForm.sociedade || "CS",
    titulo: ata.title || savedForm.titulo || savedForm.title || "",
  };
}

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
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
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: true,
    setupRequired: false,
    user: null,
  });
  const [authForm, setAuthForm] = useState(createInitialAuthForm);
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState({
    tone: "idle",
    text: "Entre para acessar o gerador de atas.",
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [sociedades, setSociedades] = useState(FALLBACK_SOCIETIES);
  const [memberOptions, setMemberOptions] = useState([]);
  const [form, setForm] = useState(createInitialForm);
  const [memberDraft, setMemberDraft] = useState(createEmptyMember);
  const [selectedRegisteredMemberId, setSelectedRegisteredMemberId] = useState("");
  const [attachmentDraft, setAttachmentDraft] = useState(createEmptyAttachment);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState(null);
  const [activeAtaId, setActiveAtaId] = useState(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isSavingAta, setIsSavingAta] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPdfStatus, setShowPdfStatus] = useState(false);
  const [status, setStatus] = useState({
    tone: "idle",
    text: "Preencha os campos. A primeira compilacao baixa o motor LaTeX no navegador.",
  });
  const draftInputRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Falha ao verificar autenticacao.");
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        setAuth({
          loading: false,
          setupRequired: Boolean(payload.setupRequired),
          user: payload.user || null,
        });
        setAuthMode(payload.setupRequired ? "setup" : "login");
        setAuthMessage({
          tone: "idle",
          text: payload.setupRequired
            ? "Crie o primeiro usuario para proteger o gerador."
            : "Entre para acessar o gerador de atas.",
        });
      } catch {
        if (active) {
          setAuth({
            loading: false,
            setupRequired: false,
            user: null,
          });
          setAuthMessage({
            tone: "error",
            text: "Nao foi possivel verificar a autenticacao.",
          });
        }
      }
    }

    loadAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSocieties() {
      try {
        const response = await fetch("/api/sociedades", { cache: "no-store" });
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

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("atas-ieee-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      return;
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("atas-ieee-theme", theme);
  }, [theme]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      preloadSwiftLatexForSociety(form.sociedade).catch(() => {
        // Warm-up opportunistically. User-facing handling happens on compile.
      });
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [form.sociedade]);

  useEffect(() => {
    if (!auth.user) {
      setActiveAtaId(null);
      setMemberOptions([]);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const ataId = Number.parseInt(params.get("ata") || "", 10);
    if (Number.isSafeInteger(ataId) && ataId > 0 && activeAtaId !== ataId) {
      handleLoadSavedAta(ataId, { replaceUrl: true });
    }
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) {
      setMemberOptions([]);
      return;
    }

    let active = true;

    async function loadMemberOptions() {
      try {
        const response = await fetch("/api/users?scope=accessible", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar membros cadastrados.");
        }

        const payload = await response.json();
        if (active) {
          setMemberOptions(Array.isArray(payload.users) ? payload.users : []);
        }
      } catch {
        if (active) {
          setMemberOptions([]);
        }
      }
    }

    loadMemberOptions();
    return () => {
      active = false;
    };
  }, [auth.user]);

  const outputName = (() => {
    const societySlug = slugify(form.sociedade || "ata");
    const dateSlug = slugify(form.data_reuniao || form.data_elaboracao || hojeFormatado());
    return `ata_${societySlug}${dateSlug ? `_${dateSlug}` : ""}`;
  })();
  const ataTitle = String(form.titulo || "").trim() || outputName;

  const selectedSocietyName =
    sociedades.find((item) => item.chave === form.sociedade)?.nome || form.sociedade;
  const allowedSociedades = auth.user
    ? sociedades.filter((item) => auth.user.chapters?.includes(item.chave))
    : sociedades;
  const hasChapterAccess = allowedSociedades.some((item) => item.chave === form.sociedade);
  const nextTheme = theme === "dark" ? "light" : "dark";

  useEffect(() => {
    if (!auth.user || !allowedSociedades.length || hasChapterAccess) {
      return;
    }

    setForm((current) => ({
      ...current,
      sociedade: allowedSociedades[0].chave,
    }));
  }, [auth.user, allowedSociedades, hasChapterAccess]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAuthField(field, value) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthMessage({
      tone: "loading",
      text: authMode === "setup" ? "Criando usuario inicial..." : "Entrando...",
    });

    try {
      const response = await fetch(`/api/auth/${authMode === "setup" ? "setup" : "login"}`, {
        body: JSON.stringify(authForm),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel autenticar."));
      }

      const payload = await response.json();
      setAuth({
        loading: false,
        setupRequired: false,
        user: payload.user,
      });
      setAuthForm(createInitialAuthForm());
      setAuthMessage({
        tone: "success",
        text: "Acesso liberado.",
      });
    } catch (error) {
      setAuthMessage({
        tone: "error",
        text: error.message || "Nao foi possivel autenticar.",
      });
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAuth({
        loading: false,
        setupRequired: false,
        user: null,
      });
      setActiveAtaId(null);
      setMemberOptions([]);
      setIsPasswordDialogOpen(false);
      setAuthMessage({
        tone: "idle",
        text: "Entre para acessar o gerador de atas.",
      });
    }
  }

  function resetForm() {
    startTransition(() => {
      setForm(createInitialForm());
      setMemberDraft(createEmptyMember());
      setAttachmentDraft(createEmptyAttachment());
      setEditingMemberId(null);
      setEditingAttachmentId(null);
      setSelectedRegisteredMemberId("");
      setActiveAtaId(null);
      setShowPdfStatus(false);
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
    if (!hasChapterAccess) missing.push("um capítulo associado ao seu usuário");
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

  function handleAddRegisteredMember() {
    const selectedMember = memberOptions.find((item) => String(item.id) === selectedRegisteredMemberId);
    if (!selectedMember) {
      setStatus({
        tone: "error",
        text: "Escolha um membro cadastrado antes de adicionar.",
      });
      return;
    }

    const alreadyAdded = form.membros.some((item) =>
      item.nome.trim().toLowerCase() === selectedMember.name.trim().toLowerCase(),
    );
    if (alreadyAdded) {
      setStatus({
        tone: "error",
        text: "Este membro ja foi adicionado na lista de presenca.",
      });
      return;
    }

    setForm((current) => ({
      ...current,
      membros: [
        ...current.membros,
        {
          cargo: selectedMember.cargo || "",
          id: crypto.randomUUID(),
          nome: selectedMember.name,
        },
      ],
    }));
    setSelectedRegisteredMemberId("");
    setStatus({ tone: "success", text: "Membro cadastrado adicionado a presenca." });
  }

  function createSavePayload() {
    return JSON.stringify(createStoredAtaPayload(form, outputName));
  }

  async function handleSaveAta() {
    if (!auth.user) {
      setStatus({
        tone: "error",
        text: "Entre antes de salvar atas no banco.",
      });
      return;
    }

    if (!hasChapterAccess) {
      setStatus({
        tone: "error",
        text: "Seu usuario nao tem acesso ao capitulo selecionado.",
      });
      return;
    }

    setIsSavingAta(true);
    setStatus({
      tone: "loading",
      text: activeAtaId ? "Atualizando ata salva no banco..." : "Salvando ata no banco...",
    });

    try {
      const response = await fetch(activeAtaId ? `/api/atas/${activeAtaId}` : "/api/atas", {
        body: createSavePayload(),
        headers: {
          "Content-Type": "application/json",
        },
        method: activeAtaId ? "PUT" : "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel salvar a ata."));
      }

      const payload = await response.json();
      if (payload.ata?.id) {
        setActiveAtaId(payload.ata.id);
      }
      if (payload.ata?.title) {
        setForm((current) => ({ ...current, titulo: payload.ata.title }));
      }

      setStatus({
        tone: "success",
        text: "Ata salva com sucesso",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel salvar a ata.",
      });
    } finally {
      setIsSavingAta(false);
    }
  }

  async function handleLoadSavedAta(ataId, options = {}) {
    setStatus({
      tone: "loading",
      text: "Carregando ata salva do banco...",
    });

    try {
      const response = await fetch(`/api/atas/${ataId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel abrir a ata salva."));
      }

      const payload = await response.json();
      const loadedForm = createFormFromStoredAta(payload.ata);
      startTransition(() => {
        setForm(loadedForm);
        setMemberDraft(createEmptyMember());
        setAttachmentDraft(createEmptyAttachment());
        setEditingMemberId(null);
        setEditingAttachmentId(null);
        setActiveAtaId(payload.ata.id);
      });
      const needsAttachmentReupload = loadedForm.anexos.some((attachment) => !attachment.file);
      setStatus({
        tone: "success",
        text: needsAttachmentReupload
          ? "Ata carregada do banco. Os arquivos dos anexos nao ficam salvos; reenvie-os antes de gerar PDF."
          : "Ata carregada do banco. Você pode editar, gerar PDF ou salvar novamente.",
      });
      if (options.replaceUrl) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel abrir a ata salva.",
      });
    }
  }

  async function handleGeneratePdf() {
    setShowPdfStatus(true);

    try {
      validateForm();
    } catch (error) {
      setStatus({ tone: "error", text: error.message });
      return;
    }

    setIsSubmitting(true);
    setStatus({
      tone: "loading",
      text: "Carregando o SwiftLaTeX e gerando o PDF no navegador. A primeira execucao pode demorar mais.",
    });

    try {
      const result = await compileAtaPdfInBrowser({
        form,
        outputName,
      });
      baixarArquivo(result.pdf, result.fileName);
      setStatus({
        tone: "success",
        text: "PDF gerado no navegador com sucesso. O download foi iniciado.",
      });
    } catch (error) {
      const message =
        error instanceof TypeError
          ? "Nao foi possivel inicializar o compilador no navegador."
          : error.message || "Nao foi possivel gerar o PDF.";

      setStatus({
        tone: "error",
        text: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDraftDownload() {
    const payload = {
      titulo: form.titulo,
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
          titulo: data.titulo || data.title || "",
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
        setActiveAtaId(null);
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

  const themeToggleButton = (
    <button
      type="button"
      className="theme-toggle"
      data-theme-current={theme}
      onClick={toggleTheme}
      aria-pressed={theme === "dark"}
      aria-label={`Alternar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
      title={`Trocar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
    >
      <span className="theme-toggle__icon" aria-hidden="true" />
      <span className="theme-toggle__label">
        {theme === "dark" ? "Tema escuro" : "Tema claro"}
      </span>
    </button>
  );

  if (auth.loading) {
    return (
      <div className="app-shell auth-shell">
        {themeToggleButton}
        <section className="hero-panel auth-card">
          <p className="panel-kicker">Autenticacao</p>
          <h1>Carregando acesso</h1>
          <p>Verificando a sessao local antes de abrir o gerador.</p>
        </section>
      </div>
    );
  }

  if (!auth.user) {
    const isSetup = authMode === "setup";

    return (
      <div className="app-shell auth-shell">
        {themeToggleButton}
        <section className="hero-panel auth-card">
          <p className="panel-kicker">Autenticacao</p>
          <h1>{isSetup ? "Crie o primeiro acesso" : "Entre para continuar"}</h1>
          <p>
            {isSetup
              ? "Este usuario inicial ficará salvo no banco Postgres configurado."
              : "Use seu usuario local para acessar as atas salvas e o gerador."}
          </p>

          <form className="auth-form" onSubmit={handleAuthSubmit}>
            {isSetup ? (
              <label className="field">
                <span>Nome</span>
                <input
                  value={authForm.name}
                  onChange={(event) => updateAuthField("name", event.target.value)}
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="field">
              <span>Nome de usuário</span>
              <input
                value={authForm.username}
                onChange={(event) => updateAuthField("username", event.target.value)}
                autoComplete="username"
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => updateAuthField("password", event.target.value)}
                autoComplete={isSetup ? "new-password" : "current-password"}
              />
            </label>

            <div className={`status-box tone-${authMessage.tone}`}>
              <span>Status</span>
              <strong>{authMessage.text}</strong>
            </div>

            <button className="primary-button" disabled={isAuthenticating}>
              {isAuthenticating
                ? "Aguarde..."
                : isSetup
                  ? "Criar acesso"
                  : "Entrar"}
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="#top" className="site-brand" aria-label="Ir para o topo">
          <span className="site-brand-badge" aria-hidden="true">
            AT
          </span>
          <span className="site-brand-lockup">
            <span className="site-brand-text">Atas IEEE</span>
            <span className="site-brand-meta">Ramo Estudantil IEEE UFJF</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="#sociedade">Sociedade</a></li>
          <li><a href="#reuniao">Reunião</a></li>
          <li><a href="#membros">Membros</a></li>
          <li><a href="#anexos">Anexos</a></li>
          <li><a href="/atas">Atas salvas</a></li>
          {auth.user.isAdmin ? <li><a href="/membros">Gestão</a></li> : null}
        </ul>

        <div className="topbar-actions">
          <button
            className="user-chip"
            type="button"
            onClick={() => setIsPasswordDialogOpen(true)}
            title="Alterar senha"
          >
            {auth.user.name}
          </button>
          <button className="ghost-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {themeToggleButton}
      {isPasswordDialogOpen ? (
        <UserPasswordDialog
          user={auth.user}
          onClose={() => setIsPasswordDialogOpen(false)}
        />
      ) : null}

      <main className="page-main" id="top">
        <div className="workspace">
          <section className="main-column">
          <article className="panel" id="sociedade">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Sociedade</p>
                <h2>Escolha o template visual</h2>
              </div>
              <div className="output-pill">{selectedSocietyName}</div>
            </div>

            {allowedSociedades.length ? (
              <div className="society-grid">
                {allowedSociedades.map((item) => (
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
            ) : (
              <div className="empty-state">
                Seu usuário ainda não está associado a nenhum capítulo.
              </div>
            )}
          </article>

          <article className="panel" id="reuniao">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Reunião</p>
                <h2>Dados principais da ata</h2>
              </div>
            </div>

            <div className="field-grid">
              <label className="field field-span-2">
                <span>Nome da ata</span>
                <input
                  maxLength={140}
                  placeholder="Ex.: Reuniao ordinaria CS - abril"
                  value={form.titulo}
                  onChange={(event) => updateField("titulo", event.target.value)}
                />
                <small>Esse nome aparece na biblioteca de atas salvas. Se ficar vazio, usamos o nome do PDF.</small>
              </label>

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

          <article className="panel" id="membros">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Presença</p>
                <h2>Membros presentes</h2>
              </div>
            </div>

            <div className="registered-member-picker">
              <label className="field">
                <span>Escolher membro cadastrado</span>
                <select
                  value={selectedRegisteredMemberId}
                  onChange={(event) => setSelectedRegisteredMemberId(event.target.value)}
                >
                  <option value="">Selecione um membro</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}{member.cargo ? ` - ${member.cargo}` : ""}
                    </option>
                  ))}
                </select>
                <small>O cargo vem da página de gestão de membros.</small>
              </label>
              <button className="soft-button" type="button" onClick={handleAddRegisteredMember}>
                Adicionar selecionado
              </button>
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

          <article className="panel" id="anexos">
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
                        {attachment.file
                          ? attachment.fileName
                          : `${attachment.fileName || "Arquivo"} precisa ser reenviado`}
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
            <article className="panel side-actions">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Ações</p>
                  <h2>Atalhos da ata</h2>
                </div>
              </div>

              <div className="sidebar-action-list">
                <button className="ghost-button" onClick={handleSaveAta} disabled={isSavingAta}>
                  {activeAtaId ? "Atualizar ata" : "Salvar ata"}
                </button>
                <a className="ghost-button standalone-link" href="/atas">
                  Ver salvas
                </a>
                {auth.user.isAdmin ? (
                  <a className="ghost-button standalone-link" href="/membros">
                    Gestão de membros
                  </a>
                ) : null}
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
            </article>

            <article className="hero-panel side-summary">
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
                <span>Nome da ata</span>
                <strong>{ataTitle}</strong>
              </div>

              <div className="summary-card">
                <span>Nome do PDF</span>
                <strong>{outputName}.pdf</strong>
              </div>

              {showPdfStatus ? (
                <div className={`status-box tone-${status.tone}`}>
                  <span>Status</span>
                  <strong>{status.text}</strong>
                </div>
              ) : null}

              <PdfGenerationProgress
                active={isSubmitting}
                form={form}
                label="Gerando ata em PDF"
              />

              <button
                className="primary-button"
                onClick={handleGeneratePdf}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Compilando..." : "Gerar PDF"}
              </button>
            </article>

          </aside>
        </div>
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
