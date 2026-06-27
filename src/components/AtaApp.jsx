"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import {
  compileAtaPdfInBrowser,
  preloadSwiftLatexForSociety,
} from "../lib/swiftlatex-client";
import {
  buildPdfFileNameFromTitle,
  formatForwardStatus,
  forwardGeneratedPdf,
} from "../lib/pdf-forward-client";
import { DEMO_MEMBERS, DEMO_USER, createDemoAtas } from "./demo-data";
import LoadingBall from "./LoadingBall";
import PdfGenerationProgress from "./PdfGenerationProgress";
import UserPasswordDialog from "./UserPasswordDialog";

const FALLBACK_SOCIETIES = [
  { chave: "CS", nome: "CS - Computer Society" },
  { chave: "PES", nome: "PES - Power & Energy Society" },
  { chave: "IAS", nome: "IAS - Industry Applications Society" },
  { chave: "MTTS", nome: "MTT-S - Microwave Theory and Technology Society" },
  { chave: "RAS", nome: "RAS - Robotics and Automation Society" },
  { chave: "CAS", nome: "CAS - Circuits and Systems Society" },
  { chave: "AESS", nome: "AESS - Aerospace and Electronic Systems Society" },
  { chave: "APS", nome: "APS - Antennas and Propagation Society" },
  { chave: "EdSoc", nome: "EdSoc - Education Society" },
  { chave: "VTS", nome: "VTS - Vehicular Technology Society" },
  { chave: "Ramo", nome: "Ramo" },
];

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

function normalizeSocietyKey(value) {
  const cleanValue = String(value || "").trim();
  if (cleanValue === "Ramo Geral" || cleanValue === "Ramo Geral IEEE") {
    return "Ramo";
  }

  return cleanValue || "CS";
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

function createDemoForm() {
  const hoje = hojeFormatado();
  return {
    ...createInitialForm(),
    autor: "Visitante Demo",
    data_elaboracao: hoje,
    data_reuniao: hoje,
    local_reuniao: "Sala do Ramo IEEE UFJF",
    membros: [
      {
        boardChapter: "CAS",
        boardPriority: 1,
        cargo: "Presidente",
        id: "demo-presenca-1",
        isBoardRole: true,
        nome: "Alex Demo",
        rawCargo: "Presidente",
        sourceMemberId: "demo-alex",
      },
      {
        boardChapter: "CAS",
        boardPriority: 1,
        cargo: "Secretário",
        id: "demo-presenca-2",
        isBoardRole: true,
        nome: "Caio Demo",
        rawCargo: "Secretário",
        sourceMemberId: "demo-caio",
      },
      {
        boardChapter: "CAS",
        boardPriority: 2,
        cargo: "Membro",
        id: "demo-presenca-3",
        isBoardRole: false,
        nome: "Daniela Demo",
        rawCargo: "Membro",
        sourceMemberId: "demo-daniela",
      },
    ],
    pautasText: "Apresentação do modo demonstração\nPlanejamento de atividades do capítulo\nDefinição de próximos responsáveis",
    resultadosText: "Visitantes puderam conhecer o fluxo de geração de atas\nA atividade de exemplo foi marcada como concluída\nO PDF de demonstração pode ser baixado localmente",
    sociedade: "CAS",
    titulo: "Ata demonstrativa CAS",
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
  const membros = prepareAtaMembers(form.membros, form.sociedade);

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
      membros: membros.map((member) => ({
        boardChapter: member.boardChapter || "",
        boardPriority: Number.isFinite(Number(member.boardPriority)) ?Number(member.boardPriority) : undefined,
        cargo: member.cargo || "",
        id: member.id,
        isBoardRole: Boolean(member.isBoardRole),
        nome: member.nome || "",
        rawCargo: member.rawCargo || "",
        sourceMemberId: member.sourceMemberId || "",
      })),
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
    ?savedForm.anexos
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
      ?savedForm.membros.map((item) => ({
          boardChapter: item.boardChapter || "",
          boardPriority: Number.isFinite(Number(item.boardPriority)) ?Number(item.boardPriority) : undefined,
          cargo: item.cargo || "",
          id: item.id || crypto.randomUUID(),
          isBoardRole: Boolean(item.isBoardRole),
          nome: item.nome || "",
          rawCargo: item.rawCargo || "",
          sourceMemberId: item.sourceMemberId || "",
        }))
      : [],
    pautasText: savedForm.pautasText || "",
    resultadosText: savedForm.resultadosText || "",
    sociedade: normalizeSocietyKey(savedForm.sociedade),
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

function getSafeNextPathFromSearch() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) {
    return "";
  }

  try {
    const url = new URL(next, window.location.origin);
    const forbiddenPath =
      url.pathname === "/login" ||
      url.pathname.startsWith("/login/") ||
      url.pathname.startsWith("/api") ||
      url.pathname.startsWith("/_next");

    if (url.origin !== window.location.origin || forbiddenPath) {
      return "";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

function formatCargoChapter(cargo, chapter) {
  const cleanCargo = String(cargo || "").trim();
  const cleanChapter = String(chapter || "").trim();

  if (!cleanCargo) {
    return "";
  }

  if (!cleanChapter || cleanCargo === "Membro") {
    return cleanCargo;
  }

  return `${cleanCargo}-${cleanChapter}`;
}

function splitCargoChapter(cargo) {
  const match = String(cargo || "").trim().match(/^(.+?)-([A-Za-z0-9]+)$/);
  if (!match) {
    return null;
  }

  return {
    chapter: match[2],
    cargo: match[1].trim(),
  };
}

function isBoardCargo(cargo) {
  const cleanCargo = String(cargo || "").trim();
  return Boolean(cleanCargo && cleanCargo !== "Membro");
}

function boardRolesForMember(member) {
  const roles = member?.chapterRoles && typeof member.chapterRoles === "object"
    ?member.chapterRoles
    : {};

  return Object.entries(roles)
    .filter(([, cargo]) => cargo && cargo !== "Membro")
    .sort(([chapterA], [chapterB]) => {
      if (chapterA === "Ramo") return -1;
      if (chapterB === "Ramo") return 1;
      return chapterA.localeCompare(chapterB);
    });
}

function isExternalChapterPresidentRole(role, society) {
  return role?.cargo === "Presidente" && role.chapter && role.chapter !== society && role.chapter !== "Ramo";
}

function isCurrentChapterBoardRole(role, society) {
  return isBoardCargo(role?.cargo) && role.chapter === society && society !== "Ramo";
}

function memberRoleForAta(member, society) {
  const roles = member?.chapterRoles && typeof member.chapterRoles === "object"
    ?member.chapterRoles
    : {};
  const boardRoles = boardRolesForMember(member);

  if (society === "Ramo" && boardRoles.length) {
    const [chapter, cargo] = boardRoles[0];
    return {
      cargo: formatCargoChapter(cargo, chapter),
      chapter,
      isBoardRole: true,
      priority: chapter === "Ramo" ?0 : 1,
      rawCargo: cargo,
    };
  }

  if (society !== "Ramo") {
    const roleForSociety = Object.prototype.hasOwnProperty.call(roles, society)
      ?roles[society] || ""
      : "";

    if (roleForSociety && roleForSociety !== "Membro") {
      return {
        cargo: roleForSociety,
        chapter: society,
        isBoardRole: true,
        priority: 1,
        rawCargo: roleForSociety,
      };
    }

    const presidentRole = boardRoles
      .map(([chapter, cargo]) => ({ cargo, chapter }))
      .find((role) => isExternalChapterPresidentRole(role, society));

    if (presidentRole) {
      return {
        cargo: formatCargoChapter(presidentRole.cargo, presidentRole.chapter),
        chapter: presidentRole.chapter,
        isBoardRole: true,
        priority: 1,
        rawCargo: presidentRole.cargo,
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(roles, society)) {
    return {
      cargo: "Membro",
      chapter: society,
      isBoardRole: false,
      priority: 2,
      rawCargo: "Membro",
    };
  }

  return {
    cargo: "Membro",
    chapter: "",
    isBoardRole: false,
    priority: 2,
    rawCargo: "Membro",
  };
}

function memberSortPriority(member, society) {
  if (Number.isFinite(Number(member.boardPriority))) {
    return Number(member.boardPriority);
  }

  const parsedCargo = splitCargoChapter(member.cargo);
  if (society !== "Ramo") {
    if (isCurrentChapterBoardRole(parsedCargo, society)) return 1;
    if (isExternalChapterPresidentRole(parsedCargo, society)) return 1;
    if (isCurrentChapterBoardRole({ cargo: member.cargo, chapter: member.boardChapter }, society)) return 1;
    return 2;
  }

  if (parsedCargo?.chapter === "Ramo" || member.boardChapter === "Ramo") {
    return 0;
  }

  if (parsedCargo || isBoardCargo(member.cargo) || member.isBoardRole) {
    return 1;
  }

  return 2;
}

function normalizeMemberForAta(member, society) {
  const parsedCargo = splitCargoChapter(member.cargo);
  if (parsedCargo) {
    if (society !== "Ramo" && isCurrentChapterBoardRole(parsedCargo, society)) {
      return {
        ...member,
        boardChapter: parsedCargo.chapter,
        boardPriority: 1,
        cargo: parsedCargo.cargo,
        isBoardRole: true,
        rawCargo: member.rawCargo || parsedCargo.cargo,
      };
    }

    if (society !== "Ramo" && !isExternalChapterPresidentRole(parsedCargo, society)) {
      return {
        ...member,
        boardChapter: "",
        boardPriority: 2,
        cargo: "Membro",
        isBoardRole: false,
        rawCargo: "Membro",
      };
    }

    const priority = society === "Ramo" && parsedCargo.chapter === "Ramo" ?0 : 1;
    return {
      ...member,
      boardChapter: member.boardChapter || parsedCargo.chapter,
      boardPriority: Number.isFinite(Number(member.boardPriority)) ?Number(member.boardPriority) : priority,
      cargo: formatCargoChapter(parsedCargo.cargo, parsedCargo.chapter),
      isBoardRole: true,
      rawCargo: member.rawCargo || parsedCargo.cargo,
    };
  }

  if (isBoardCargo(member.cargo)) {
    const chapter = member.boardChapter || society;
    if (society !== "Ramo" && isCurrentChapterBoardRole({ cargo: member.cargo, chapter }, society)) {
      return {
        ...member,
        boardChapter: chapter,
        boardPriority: 1,
        cargo: member.cargo,
        isBoardRole: true,
        rawCargo: member.rawCargo || member.cargo,
      };
    }

    if (society !== "Ramo" && !isExternalChapterPresidentRole({ cargo: member.cargo, chapter }, society)) {
      return {
        ...member,
        boardChapter: "",
        boardPriority: 2,
        cargo: "Membro",
        isBoardRole: false,
        rawCargo: "Membro",
      };
    }

    return {
      ...member,
      boardChapter: chapter,
      boardPriority: Number.isFinite(Number(member.boardPriority)) ?Number(member.boardPriority) : society === "Ramo" && chapter === "Ramo" ?0 : 1,
      cargo: formatCargoChapter(member.cargo, chapter),
      isBoardRole: true,
      rawCargo: member.rawCargo || member.cargo,
    };
  }

  return member;
}

function prepareAtaMembers(members, society) {
  return orderedAtaMembers(members.map((member) => normalizeMemberForAta(member, society)), society);
}

function normalizeMemberName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findRegisteredMember(member, options) {
  const sourceId = member.sourceMemberId || member.registeredMemberId;
  if (sourceId) {
    const byId = options.find((option) => String(option.id) === String(sourceId));
    if (byId) {
      return byId;
    }
  }

  const memberName = normalizeMemberName(member.nome);
  if (!memberName) {
    return null;
  }

  return options.find((option) => normalizeMemberName(option.name) === memberName) || null;
}

function prepareAtaMembersFromRegistry(members, society, options) {
  const refreshedMembers = members.map((member) => {
    const registeredMember = findRegisteredMember(member, options);
    if (!registeredMember) {
      return member;
    }

    const memberRole = memberRoleForAta(registeredMember, society);
    return {
      ...member,
      boardChapter: memberRole.chapter,
      boardPriority: memberRole.priority,
      cargo: memberRole.cargo || member.cargo,
      isBoardRole: memberRole.isBoardRole,
      nome: registeredMember.name || member.nome,
      rawCargo: memberRole.rawCargo,
      sourceMemberId: registeredMember.id,
    };
  });

  return prepareAtaMembers(refreshedMembers, society);
}

function orderedAtaMembers(members, society) {
  return [...members].sort((memberA, memberB) => {
    const priorityDiff = memberSortPriority(memberA, society) - memberSortPriority(memberB, society);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return String(memberA.nome || "").localeCompare(String(memberB.nome || ""), "pt-BR");
  });
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

function App({ demoMode = false } = {}) {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: !demoMode,
    setupRequired: false,
    user: demoMode ?DEMO_USER : null,
  });
  const [authForm, setAuthForm] = useState(createInitialAuthForm);
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState({
    tone: "idle",
    text: "Entre para acessar o gerador de atas.",
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [sociedades, setSociedades] = useState(FALLBACK_SOCIETIES);
  const [memberOptions, setMemberOptions] = useState(demoMode ?DEMO_MEMBERS : []);
  const [form, setForm] = useState(demoMode ?createDemoForm : createInitialForm);
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
    text: demoMode
      ?"Modo demo aberto: dados fictícios, sem login, sem salvar banco e sem envio de PDF ao servidor."
      :"Preencha os campos. A primeira compilacao baixa o motor LaTeX no navegador.",
  });
  const draftInputRef = useRef(null);

  useEffect(() => {
    if (demoMode) {
      setAuth({
        loading: false,
        setupRequired: false,
        user: DEMO_USER,
      });
      setMemberOptions(DEMO_MEMBERS);
      return undefined;
    }

    let active = true;

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Falha ao verificar autenticação.");
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
        setAuthMode(payload.setupRequired ?"setup" : "login");
        setAuthMessage({
          tone: "idle",
          text: payload.setupRequired
            ?"Crie o primeiro usuário para proteger o gerador."
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
            text: "Não foi possível verificar a autenticação.",
          });
        }
      }
    }

    loadAuth();
    return () => {
      active = false;
    };
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode && !auth.loading && !auth.user) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [auth.loading, auth.user, demoMode]);

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
    setSelectedRegisteredMemberId("");
  }, [form.sociedade]);

  useEffect(() => {
    if (demoMode) {
      setActiveAtaId(null);
      setMemberOptions(DEMO_MEMBERS);
      return;
    }

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
  }, [auth.user, demoMode]);

  async function refreshMemberOptions(society = form.sociedade) {
    if (demoMode) {
      const users = DEMO_MEMBERS.filter((member) =>
        member.chapterRoles?.[society] || member.chapterRoles?.Ramo,
      );
      setMemberOptions(users);
      return users;
    }

    if (!auth.user) {
      setMemberOptions([]);
      return [];
    }

    const params = new URLSearchParams({
      chapter: society,
      scope: "accessible",
    });
    const response = await fetch(`/api/users?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Não foi possível carregar membros cadastrados.");
    }

    const payload = await response.json();
    const users = Array.isArray(payload.users) ?payload.users : [];
    setMemberOptions(users);
    return users;
  }

  useEffect(() => {
    if (demoMode) {
      refreshMemberOptions(form.sociedade);
      return;
    }

    if (!auth.user) {
      setMemberOptions([]);
      return;
    }

    let active = true;

    async function loadMemberOptions() {
      try {
        const users = await refreshMemberOptions(form.sociedade);
        if (active) setMemberOptions(users);
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
  }, [auth.user, form.sociedade, demoMode]);

  const outputName = (() => {
    const societySlug = slugify(form.sociedade || "ata");
    const dateSlug = slugify(form.data_reuniao || form.data_elaboracao || hojeFormatado());
    return `ata_${societySlug}${dateSlug ?`_${dateSlug}` : ""}`;
  })();
  const ataTitle = String(form.titulo || "").trim() || outputName;

  const selectedSocietyName =
    sociedades.find((item) => item.chave === form.sociedade)?.nome || form.sociedade;
  const userChapterKeys = auth.user?.chapters || [];
  const allowedSociedades = auth.user
    ?auth.user.isAdmin
      ?sociedades
      :sociedades.filter((item) => userChapterKeys.includes(item.chave))
    : sociedades;
  const hasChapterAccess = allowedSociedades.some((item) => item.chave === form.sociedade);
  const nextTheme = theme === "dark" ?"light" : "dark";

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
    setTheme((current) => (current === "dark" ?"light" : "dark"));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthMessage({
      tone: "loading",
      text: authMode === "setup" ?"Criando usuário inicial..." : "Entrando...",
    });

    try {
      const response = await fetch(`/api/auth/${authMode === "setup" ?"setup" : "login"}`, {
        body: JSON.stringify(authForm),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível autenticar."));
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
      const nextPath = getSafeNextPathFromSearch();
      if (nextPath) {
        window.location.href = nextPath;
      }
    } catch (error) {
      setAuthMessage({
        tone: "error",
        text: error.message || "Não foi possível autenticar.",
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
      setForm(demoMode ?createDemoForm() : createInitialForm());
      setMemberDraft(createEmptyMember());
      setAttachmentDraft(createEmptyAttachment());
      setEditingMemberId(null);
      setEditingAttachmentId(null);
      setSelectedRegisteredMemberId("");
      setActiveAtaId(null);
      setShowPdfStatus(false);
      setStatus({
        tone: "idle",
        text: demoMode
          ?"Demonstração restaurada. Nada foi salvo no sistema real."
          :"Formulário limpo. Você pode começar outra ata.",
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
            ?{
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
    if (file) {
      if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
        setAttachmentDraft((current) => ({
          ...current,
          file: null,
          fileName: "",
        }));
        setStatus({
          tone: "error",
          text: "Use anexos em PNG, JPG ou WebP.",
        });
        return;
      }

      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachmentDraft((current) => ({
          ...current,
          file: null,
          fileName: "",
        }));
        setStatus({
          tone: "error",
          text: "Cada anexo pode ter no máximo 4 MB.",
        });
        return;
      }
    }

    setAttachmentDraft((current) => ({
      ...current,
      file,
      fileName: file ?file.name : current.fileName,
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

    if (!editingAttachmentId && form.anexos.length >= MAX_ATTACHMENTS) {
      setStatus({
        tone: "error",
        text: `Use no máximo ${MAX_ATTACHMENTS} anexos por ata.`,
      });
      return;
    }

    if (editingAttachmentId) {
      setForm((current) => ({
        ...current,
        anexos: current.anexos.map((item) =>
          item.id === editingAttachmentId
            ?{
                ...item,
                legenda: attachmentDraft.legenda.trim(),
                file: attachmentDraft.file ? attachmentDraft.file : item.file,
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
      file: null,
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
        text: "Este membro já foi adicionado na lista de presença.",
      });
      return;
    }

    setForm((current) => {
      const memberRole = memberRoleForAta(selectedMember, current.sociedade);
      return {
        ...current,
        membros: [
          ...current.membros,
          {
            boardChapter: memberRole.chapter,
            boardPriority: memberRole.priority,
            cargo: memberRole.cargo,
            id: crypto.randomUUID(),
            isBoardRole: memberRole.isBoardRole,
            nome: selectedMember.name,
            rawCargo: memberRole.rawCargo,
            sourceMemberId: selectedMember.id,
          },
        ],
      };
    });
    setSelectedRegisteredMemberId("");
    setStatus({ tone: "success", text: "Membro cadastrado adicionado à presença." });
  }

  function createSavePayload(formOverride = form) {
    return JSON.stringify(createStoredAtaPayload(formOverride, outputName));
  }

  async function persistAta({
    formOverride = form,
    loadingText = activeAtaId ?"Atualizando ata salva no banco..." : "Salvando ata no banco...",
    successText = "Ata salva com sucesso",
    updateStatus = true,
  } = {}) {
    if (demoMode) {
      throw new Error("O modo demo não salva atas no banco.");
    }

    if (!auth.user) {
      throw new Error("Entre antes de salvar atas no banco.");
    }

    if (!hasChapterAccess) {
      throw new Error("Seu usuário não tem acesso ao capítulo selecionado.");
    }

    if (updateStatus) {
      setStatus({
        tone: "loading",
        text: loadingText,
      });
    }

    const response = await fetch(activeAtaId ?`/api/atas/${activeAtaId}` : "/api/atas", {
      body: createSavePayload(formOverride),
      headers: {
        "Content-Type": "application/json",
      },
      method: activeAtaId ?"PUT" : "POST",
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Não foi possível salvar a ata."));
    }

    const payload = await response.json();
    if (payload.ata?.id) {
      setActiveAtaId(payload.ata.id);
    }
    if (payload.ata?.title) {
      setForm((current) => ({ ...current, titulo: payload.ata.title }));
    }

    if (updateStatus) {
      setStatus({
        tone: "success",
        text: successText,
      });
    }

    return payload.ata || null;
  }

  async function handleSaveAta() {
    if (demoMode) {
      setStatus({
        tone: "idle",
        text: "Salvar no banco fica desativado no modo demo. Use \"Baixar rascunho\" para exportar o exemplo.",
      });
      return;
    }

    setIsSavingAta(true);
    try {
      const currentMemberOptions = await refreshMemberOptions(form.sociedade);
      await persistAta({
        formOverride: {
          ...form,
          membros: prepareAtaMembersFromRegistry(form.membros, form.sociedade, currentMemberOptions),
        },
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível salvar a ata.",
      });
    } finally {
      setIsSavingAta(false);
    }
  }

  async function handleLoadSavedAta(ataId, options = {}) {
    if (demoMode) {
      const demoAta = createDemoAtas().find((ata) => ata.id === ataId);
      if (demoAta) {
        const loadedForm = createFormFromStoredAta(demoAta);
        startTransition(() => {
          setForm(loadedForm);
          setMemberDraft(createEmptyMember());
          setAttachmentDraft(createEmptyAttachment());
          setEditingMemberId(null);
          setEditingAttachmentId(null);
          setActiveAtaId(null);
        });
        setStatus({
          tone: "success",
          text: "Ata demo carregada localmente no gerador.",
        });
        if (options.replaceUrl) {
          window.history.replaceState(null, "", window.location.pathname);
        }
        return;
      }

      setStatus({
        tone: "error",
        text: "Ata demo não encontrada.",
      });
      return;
    }

    setStatus({
      tone: "loading",
      text: "Carregando ata salva do banco...",
    });

    try {
      const response = await fetch(`/api/atas/${ataId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível abrir a ata salva."));
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
          ?"Ata carregada do banco. Os arquivos dos anexos não ficam salvos; reenvie-os antes de gerar PDF."
          : "Ata carregada do banco. Você pode editar, gerar PDF ou salvar novamente.",
      });
      if (options.replaceUrl) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível abrir a ata salva.",
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

    if (demoMode) {
      setIsSubmitting(true);
      setStatus({
        tone: "loading",
        text: "Gerando PDF de demonstração localmente no navegador. Nenhum dado será salvo ou enviado.",
      });

      try {
        const generationForm = {
          ...form,
          membros: prepareAtaMembersFromRegistry(form.membros, form.sociedade, memberOptions),
        };
        const result = await compileAtaPdfInBrowser({
          form: generationForm,
          outputName,
        });
        const pdfFileName = buildPdfFileNameFromTitle(ataTitle, result.fileName);
        baixarArquivo(result.pdf, pdfFileName);
        setStatus({
          tone: "success",
          text: "PDF demo gerado no navegador e download iniciado. Nada foi salvo no banco ou enviado ao servidor JS.",
        });
      } catch (error) {
        setStatus({
          tone: "error",
          text: error instanceof TypeError
            ?"Não foi possível inicializar o compilador no navegador."
            : error.message || "Não foi possível gerar o PDF demo.",
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    setIsSavingAta(true);
    setStatus({
      tone: "loading",
      text: "Salvando ata no banco antes de gerar o PDF.",
    });

    let wasSaved = false;

    try {
      const currentMemberOptions = await refreshMemberOptions(form.sociedade);
      const generationForm = {
        ...form,
        membros: prepareAtaMembersFromRegistry(form.membros, form.sociedade, currentMemberOptions),
      };
      const savedAta = await persistAta({
        formOverride: generationForm,
        loadingText: "Salvando ata no banco antes de gerar o PDF.",
        updateStatus: false,
      });
      wasSaved = true;
      setStatus({
        tone: "loading",
        text: "Ata salva com sucesso. Carregando o SwiftLaTeX e gerando o PDF no navegador.",
      });

      const result = await compileAtaPdfInBrowser({
        form: generationForm,
        outputName,
      });

      setStatus({
        tone: "loading",
        text: "PDF gerado. Enviando ao servidor JS.",
      });

      const pdfFileName = buildPdfFileNameFromTitle(ataTitle, result.fileName);
      let forwardMessage = "PDF enviado ao servidor JS.";
      let forwardTone = "success";
      try {
        const forwardResult = await forwardGeneratedPdf({
          fileName: pdfFileName,
          metadata: {
            ataId: savedAta?.id || activeAtaId,
            fileName: pdfFileName,
            originalGeneratedFileName: result.fileName,
            outputName,
            sociedade: form.sociedade,
            source: "gerador",
            targetFolder: `/atas/${form.sociedade}`,
            title: ataTitle,
          },
          pdf: result.pdf,
        });
        forwardMessage = formatForwardStatus(forwardResult);
      } catch (forwardError) {
        forwardTone = "error";
        forwardMessage =
          forwardError.message || "Não foi possível enviar o PDF ao servidor JS.";
      }

      baixarArquivo(result.pdf, pdfFileName);
      setStatus({
        tone: forwardTone,
        text: `Ata salva com sucesso. PDF gerado no navegador e download iniciado. ${forwardMessage}`,
      });
    } catch (error) {
      const message = wasSaved
        ?error instanceof TypeError
          ?"Ata salva com sucesso, mas não foi possível inicializar o compilador no navegador."
          : `Ata salva com sucesso, mas ${error.message || "não foi possível gerar o PDF."}`
        : error.message || "Não foi possível salvar a ata antes de gerar o PDF.";

      setStatus({
        tone: "error",
        text: message,
      });
    } finally {
      setIsSubmitting(false);
      setIsSavingAta(false);
    }
  }

  function handleDraftDownload() {
    const membros = prepareAtaMembersFromRegistry(form.membros, form.sociedade, memberOptions);
    const payload = {
      titulo: form.titulo,
      sociedade: form.sociedade,
      arquivo_saida: outputName,
      data_elaboracao: form.data_elaboracao,
      autor: form.autor,
      data_reuniao: form.data_reuniao,
      local_reuniao: form.local_reuniao,
      membros: membros.map(({ nome, cargo }) => ({ nome, cargo })),
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
          sociedade: normalizeSocietyKey(data.sociedade),
          titulo: data.titulo || data.title || "",
          data_elaboracao: data.data_elaboracao || hojeFormatado(),
          autor: data.autor || "",
          data_reuniao: data.data_reuniao || hojeFormatado(),
          local_reuniao: data.local_reuniao || "",
          pautasText: Array.isArray(data.pautas) ?data.pautas.join("\n") : "",
          resultadosText: Array.isArray(data.resultados)
            ?data.resultados.join("\n")
            : "",
          membros: Array.isArray(data.membros)
            ?data.membros.map((item) => ({
                boardChapter: item.boardChapter || "",
                boardPriority: Number.isFinite(Number(item.boardPriority)) ?Number(item.boardPriority) : undefined,
                cargo: item.cargo || "",
                id: crypto.randomUUID(),
                isBoardRole: Boolean(item.isBoardRole),
                nome: item.nome || "",
                rawCargo: item.rawCargo || "",
                sourceMemberId: item.sourceMemberId || "",
              }))
            : [],
          anexos: Array.isArray(data.anexos)
            ?data.anexos.map((item) => ({
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
      aria-label={`Alternar para tema ${nextTheme === "dark" ?"escuro" : "claro"}`}
      title={`Trocar para tema ${nextTheme === "dark" ?"escuro" : "claro"}`}
    >
      <span className="theme-toggle__icon" aria-hidden="true" />
      <span className="theme-toggle__label">
        {theme === "dark" ?"Tema escuro" : "Tema claro"}
      </span>
    </button>
  );

  if (auth.loading) {
    return <LoadingBall />;
  }

  if (!auth.user) {
    return <LoadingBall />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href={demoMode ?"/demo" : "/"} className="site-brand" aria-label="Ir para início">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">IEEE UFJF</span>
          </span>
        </a>

        {demoMode ?(
          <ul className="nav-links">
            <li><a href="/demo">Início</a></li>
            <li><a href="/demo/atas" aria-current="page">Atas</a></li>
            <li><a href="/demo/tarefas">Tarefas</a></li>
            <li><a href="/demo/calendario">Calendário</a></li>
            <li><a href="/demo/diretoria">Diretoria</a></li>
          </ul>
        ) : (
          <ul className="nav-links">
            <li><a href="/">Início</a></li>
            <li><a href="/atas" aria-current="page">Atas</a></li>
            <li><a href="/tarefas">Tarefas</a></li>
            <li><a href="/calendario">Calendário</a></li>
            {auth.user.canManageMembers ?<li><a href="/diretoria">Diretoria</a></li> : null}
          </ul>
        )}

        {demoMode ?(
          <div className="topbar-actions">
            <span className="user-chip">Modo demo</span>
          </div>
        ) : (
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
        )}
      </header>

      {themeToggleButton}
      {!demoMode && isPasswordDialogOpen ?(
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

            {allowedSociedades.length ?(
              <div className="society-grid">
                {allowedSociedades.map((item) => (
                  <button
                    key={item.chave}
                    type="button"
                    className={`society-card ${
                      form.sociedade === item.chave ?"is-active" : ""
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
                  {memberOptions.map((member) => {
                    const societyCargo = memberRoleForAta(member, form.sociedade).cargo;

                    return (
                      <option key={member.id} value={member.id}>
                        {member.name}{societyCargo ?` - ${societyCargo}` : ""}
                      </option>
                    );
                  })}
                </select>
                <small>O cargo vem da gestão de membros para a sociedade selecionada.</small>
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
                {editingMemberId ?"Salvar edição" : "Adicionar membro"}
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
              {form.membros.length ?(
                prepareAtaMembers(form.membros, form.sociedade).map((member, index) => (
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
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    handleAttachmentFile(event.target.files?.[0] || null)
                  }
                />
                <small>
                  {attachmentDraft.fileName
                    ?`Selecionado: ${attachmentDraft.fileName}`
                    : "Nenhum arquivo selecionado"}
                </small>
              </label>
            </div>

            <div className="inline-actions">
              <button className="soft-button" onClick={handleAttachmentSave}>
                {editingAttachmentId ?"Salvar edição" : "Adicionar anexo"}
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
              {form.anexos.length ?(
                form.anexos.map((attachment) => (
                  <div className="list-row" key={attachment.id}>
                    <div className="list-index attachment-index">+</div>
                    <div className="list-content">
                      <strong>{attachment.legenda}</strong>
                      <span>
                        {attachment.file
                          ?attachment.fileName
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
                {demoMode ?(
                  <>
                    <div className="status-box tone-idle">
                      <span>Demo isolado</span>
                      <strong>O PDF é gerado localmente e nada é enviado ao servidor.</strong>
                    </div>
                    <a className="ghost-button standalone-link" href="/demo/atas/banco">
                      Ver atas demo
                    </a>
                    <a className="ghost-button standalone-link" href="/demo/tarefas">
                      Tarefas
                    </a>
                    <a className="ghost-button standalone-link" href="/demo/calendario">
                      Calendário
                    </a>
                    <a className="ghost-button standalone-link" href="/demo/diretoria">
                      Diretoria
                    </a>
                  </>
                ) : (
                  <>
                    <button className="ghost-button" onClick={handleSaveAta} disabled={isSavingAta || isSubmitting}>
                      {isSavingAta ?"Salvando..." : activeAtaId ?"Atualizar ata" : "Salvar ata"}
                    </button>
                    <a className="ghost-button standalone-link" href="/atas">
                      Ver salvas
                    </a>
                    <a className="ghost-button standalone-link" href="/tarefas">
                      Tarefas
                    </a>
                    <a className="ghost-button standalone-link" href="/calendario">
                      Calendário
                    </a>
                    {auth.user.canManageMembers ?(
                      <a className="ghost-button standalone-link" href="/diretoria">
                        Diretoria
                      </a>
                    ) : null}
                  </>
                )}
                <button className="ghost-button" onClick={() => draftInputRef.current?.click()}>
                  Importar rascunho
                </button>
                <button className="ghost-button" onClick={handleDraftDownload}>
                  Baixar rascunho
                </button>
                <button className="ghost-button ghost-danger" onClick={resetForm}>
                  {demoMode ?"Restaurar demo" : "Limpar tudo"}
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

              {showPdfStatus ?(
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
                disabled={isSubmitting || isSavingAta}
              >
                {isSubmitting
                  ?demoMode
                    ?"Gerando demo..."
                    :"Salvando e compilando..."
                  : demoMode
                    ?"Gerar PDF demo"
                    :"Gerar PDF"}
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
