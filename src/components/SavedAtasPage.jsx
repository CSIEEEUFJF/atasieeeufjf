"use client";

import { useEffect, useState } from "react";

import LoadingBall from "./LoadingBall";
import { compileAtaPdfInBrowser } from "../lib/swiftlatex-client";
import {
  buildPdfFileNameFromTitle,
  formatForwardStatus,
  forwardGeneratedPdf,
} from "../lib/pdf-forward-client";
import PdfGenerationProgress from "./PdfGenerationProgress";
import UserPasswordDialog from "./UserPasswordDialog";
import { DEMO_CHAPTERS, DEMO_USER, createDemoAtas } from "./demo-data";

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) {
    return "Sem data";
  }

  return new Date(value).toLocaleString("pt-BR");
}

function normalizeSocietyKey(value) {
  const cleanValue = String(value || "").trim();
  if (cleanValue === "Ramo Geral" || cleanValue === "Ramo Geral IEEE") {
    return "Ramo";
  }

  return cleanValue || "CS";
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
    data_elaboracao: savedForm.data_elaboracao || "",
    data_reuniao: savedForm.data_reuniao || "",
    local_reuniao: savedForm.local_reuniao || "",
    membros: Array.isArray(savedForm.membros)
      ?savedForm.membros.map((item) => ({
          cargo: item.cargo || "",
          id: item.id || crypto.randomUUID(),
          nome: item.nome || "",
        }))
      : [],
    pautasText: savedForm.pautasText || "",
    resultadosText: savedForm.resultadosText || "",
    sociedade: normalizeSocietyKey(savedForm.sociedade || ata.sociedade),
    titulo: ata.title || savedForm.titulo || savedForm.title || "",
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
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function validateSavedAtaForm(form) {
  const missing = [];

  if (!form.data_elaboracao.trim()) missing.push("data da elaboracao");
  if (!form.autor.trim()) missing.push("autor");
  if (!form.data_reuniao.trim()) missing.push("data da reunião");
  if (!form.local_reuniao.trim()) missing.push("local da reunião");
  if (!form.membros.length) missing.push("ao menos um membro");
  if (!form.pautasText.trim()) missing.push("ao menos uma pauta");
  if (!form.resultadosText.trim()) missing.push("ao menos um resultado");
  if (form.anexos.some((item) => !item.file)) {
    missing.push("arquivos dos anexos, que não ficam armazenados no banco");
  }

  if (missing.length) {
    throw new Error(`Não foi possível gerar o PDF. Corrija: ${missing.join(", ")}.`);
  }
}

function SavedAtasPage({ demoMode = false } = {}) {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: !demoMode,
    setupRequired: false,
    user: demoMode ?DEMO_USER : null,
  });
  const [chapters, setChapters] = useState(demoMode ?DEMO_CHAPTERS : []);
  const [atas, setAtas] = useState(demoMode ?createDemoAtas : []);
  const [status, setStatus] = useState({
    tone: demoMode ?"success" : "idle",
    text: demoMode ?"Banco de atas demo carregado com registros fictícios." : "Carregando suas atas salvas.",
  });
  const [isLoadingAtas, setIsLoadingAtas] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [generationProgressForm, setGenerationProgressForm] = useState(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

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
    let active = true;

    if (demoMode) {
      setAuth({
        loading: false,
        setupRequired: false,
        user: DEMO_USER,
      });
      setChapters(DEMO_CHAPTERS);
      setAtas(createDemoAtas());
      setStatus({ tone: "success", text: "Banco de atas demo carregado com registros fictícios." });
      return () => {
        active = false;
      };
    }

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Não foi possível verificar a autenticação.");
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
        setChapters(Array.isArray(payload.chapters) ?payload.chapters : []);
      } catch (error) {
        if (active) {
          setAuth({
            loading: false,
            setupRequired: false,
            user: null,
          });
          setStatus({
            tone: "error",
            text: error.message || "Não foi possível verificar a autenticação.",
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
    if (demoMode) {
      return;
    }

    if (!auth.user) {
      return;
    }

    loadAtas();
  }, [auth.user, demoMode]);

  useEffect(() => {
    if (!demoMode && !auth.loading && !auth.user) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [auth.loading, auth.user, demoMode]);

  const nextTheme = theme === "dark" ?"light" : "dark";
  const userChapterSet = new Set(auth.user?.chapters || []);
  const accessibleChapters = chapters.filter((chapter) => userChapterSet.has(chapter.key));
  const atasByChapter = accessibleChapters.map((chapter) => ({
    ...chapter,
    atas: atas.filter((ata) => ata.sociedade === chapter.key),
  }));

  function toggleTheme() {
    setTheme((current) => (current === "dark" ?"light" : "dark"));
  }

  async function loadAtas() {
    if (demoMode) {
      setAtas(createDemoAtas());
      setStatus({ tone: "success", text: "Atas demo restauradas." });
      return;
    }

    setIsLoadingAtas(true);
    setStatus({
      tone: "loading",
      text: "Atualizando lista de atas salvas.",
    });

    try {
      const response = await fetch("/api/atas", { cache: "no-store" });
      if (response.status === 401) {
        setAuth((current) => ({ ...current, user: null }));
        setStatus({
          tone: "error",
          text: "Sua sessão expirou. Entre novamente pelo gerador.",
        });
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível carregar as atas."));
      }

      const payload = await response.json();
      setAtas(Array.isArray(payload.atas) ?payload.atas : []);
      setStatus({
        tone: "success",
        text: "Lista de atas salvas atualizada.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível carregar as atas.",
      });
    } finally {
      setIsLoadingAtas(false);
    }
  }

  async function handleDelete(ataId) {
    const confirmed = window.confirm("Excluir esta ata salva do banco?");
    if (!confirmed) {
      return;
    }

    setDeletingId(ataId);
    setStatus({
      tone: "loading",
      text: "Excluindo ata salva.",
    });

    try {
      if (demoMode) {
        setAtas((current) => current.filter((ata) => ata.id !== ataId));
        setStatus({
          tone: "success",
          text: "Ata demo removida localmente.",
        });
        return;
      }

      const response = await fetch(`/api/atas/${ataId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível excluir a ata."));
      }

      setAtas((current) => current.filter((ata) => ata.id !== ataId));
      setStatus({
        tone: "success",
        text: "Ata removida do banco.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível excluir a ata.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRename(ata) {
    const nextTitle = window.prompt("Novo nome da ata:", ata.title || "");
    if (nextTitle === null) {
      return;
    }

    const cleanTitle = nextTitle.trim();
    if (!cleanTitle || cleanTitle === ata.title) {
      return;
    }

    setRenamingId(ata.id);
    setStatus({
      tone: "loading",
      text: "Renomeando ata salva.",
    });

    try {
      if (demoMode) {
        setAtas((current) =>
          current.map((item) => (item.id === ata.id ?{ ...item, title: cleanTitle } : item)),
        );
        setStatus({
          tone: "success",
          text: "Ata demo renomeada localmente.",
        });
        return;
      }

      const response = await fetch(`/api/atas/${ata.id}`, {
        body: JSON.stringify({ title: cleanTitle }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível renomear a ata."));
      }

      const payload = await response.json();
      setAtas((current) =>
        current.map((item) => (item.id === ata.id ?payload.ata || item : item)),
      );
      setStatus({
        tone: "success",
        text: "Ata renomeada.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível renomear a ata.",
      });
    } finally {
      setRenamingId(null);
    }
  }

  async function handleGenerateSavedAta(ataId) {
    if (generatingId !== null) {
      return;
    }

    setGeneratingId(ataId);
    setStatus({
      tone: "loading",
      text: "Carregando ata salva e gerando PDF no navegador.",
    });

    try {
      if (demoMode) {
        const demoAta = atas.find((item) => item.id === ataId);
        if (!demoAta) {
          throw new Error("Ata demo não encontrada.");
        }

        const form = createFormFromStoredAta(demoAta);
        validateSavedAtaForm(form);
        setGenerationProgressForm(form);
        const result = await compileAtaPdfInBrowser({
          form,
          outputName: demoAta.outputName || demoAta.title || "ata_demo",
        });
        const ataTitle = demoAta.title || form.titulo || demoAta.outputName || "ata_demo";
        const pdfFileName = buildPdfFileNameFromTitle(ataTitle, result.fileName);
        baixarArquivo(result.pdf, pdfFileName);
        setStatus({
          tone: "success",
          text: "PDF demo gerado no navegador. Nenhum arquivo foi enviado ao servidor.",
        });
        return;
      }

      const response = await fetch(`/api/atas/${ataId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível abrir a ata salva."));
      }

      const payload = await response.json();
      const form = createFormFromStoredAta(payload.ata);
      validateSavedAtaForm(form);
      setGenerationProgressForm(form);

      const result = await compileAtaPdfInBrowser({
        form,
        outputName: payload.ata.outputName || payload.ata.title || "ata_preenchida",
      });

      const ataTitle = payload.ata.title || form.titulo || payload.ata.outputName || "ata_preenchida";
      const pdfFileName = buildPdfFileNameFromTitle(ataTitle, result.fileName);
      baixarArquivo(result.pdf, pdfFileName);
      setStatus({
        tone: "loading",
        text: "PDF gerado e download iniciado. Enviando uma cópia ao servidor JS.",
      });

      let forwardMessage = "PDF enviado ao servidor JS.";
      let forwardTone = "success";
      try {
        const forwardResult = await forwardGeneratedPdf({
          fileName: pdfFileName,
          metadata: {
            ataId: payload.ata.id,
            fileName: pdfFileName,
            originalGeneratedFileName: result.fileName,
            outputName: payload.ata.outputName,
            sociedade: form.sociedade,
            source: "atas-salvas",
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

      setStatus({
        tone: forwardTone,
        text: `PDF gerado a partir da ata salva. O download foi iniciado. ${forwardMessage}`,
      });
    } catch (error) {
      const message =
        error instanceof TypeError
          ?"Não foi possível inicializar o compilador no navegador."
          : error.message || "Não foi possível gerar o PDF da ata salva.";

      setStatus({
        tone: "error",
        text: message,
      });
    } finally {
      setGenerationProgressForm(null);
      setGeneratingId(null);
    }
  }

  function handleSavedAtaAction(ata) {
    if (Number(ata.attachmentCount || 0) > 0) {
      window.location.href = demoMode ?`/demo/atas/nova?ata=${ata.id}` : `/atas/nova?ata=${ata.id}`;
      return;
    }

    handleGenerateSavedAta(ata.id);
  }

  async function handleLogout() {
    if (demoMode) {
      window.location.href = "/demo";
      return;
    }

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
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
        <a href={demoMode ?"/demo/atas/banco" : "/"} className="site-brand" aria-label="Ir para início">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Banco de atas por capítulo</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href={demoMode ?"/demo" : "/"}>Início</a></li>
          <li><a href={demoMode ?"/demo/atas" : "/atas"} aria-current="page">Atas</a></li>
          <li><a href={demoMode ?"/demo/tarefas" : "/tarefas"}>Tarefas</a></li>
          <li><a href={demoMode ?"/demo/calendario" : "/calendario"}>Calendário</a></li>
          {auth.user.canManageMembers ?<li><a href={demoMode ?"/demo/diretoria" : "/diretoria"}>Diretoria</a></li> : null}
        </ul>

        <div className="topbar-actions">
          {demoMode ?(
            <span className="user-chip">Modo demo</span>
          ) : (
            <button
              className="user-chip"
              type="button"
              onClick={() => setIsPasswordDialogOpen(true)}
              title="Alterar senha"
            >
              {auth.user.name}
            </button>
          )}
          <button className="ghost-button" onClick={loadAtas} disabled={isLoadingAtas}>
            Atualizar
          </button>
          {!demoMode ?(
            <button className="ghost-button" onClick={handleLogout}>
              Sair
            </button>
          ) : null}
        </div>
      </header>

      {themeToggleButton}
      {!demoMode && isPasswordDialogOpen ?(
        <UserPasswordDialog
          user={auth.user}
          onClose={() => setIsPasswordDialogOpen(false)}
        />
      ) : null}

      <main className="page-main saved-page-main">
        <section className="hero-panel saved-hero">
          <div>
            <p className="panel-kicker">Banco de atas</p>
            <h1>Atas salvas</h1>
            <p>
              Consulte atas separadas por capítulo. Cada usuário vê apenas os capítulos
              aos quais está associado.
            </p>
          </div>
          <div className={`status-box tone-${status.tone}`}>
            <span>Status</span>
            <strong>{status.text}</strong>
          </div>
          <PdfGenerationProgress
            active={Boolean(generationProgressForm)}
            form={generationProgressForm}
            label="Gerando ata salva em PDF"
          />
        </section>

        <section className="panel saved-library">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Biblioteca</p>
              <h2>{atas.length ?`${atas.length} ata(s) nos seus capítulos` : "Nenhuma ata salva"}</h2>
            </div>
            <a className="soft-button standalone-link" href={demoMode ?"/demo/atas/nova" : "/atas/nova"}>
              Criar nova ata
            </a>
          </div>

          <div className="chapter-sections">
            {atasByChapter.length ?(
              atasByChapter.map((chapter) => (
                <section className="chapter-section" key={chapter.key}>
                  <div className="chapter-section-header">
                    <div>
                      <span>{chapter.key}</span>
                      <h3>{chapter.label}</h3>
                    </div>
                    <strong>{chapter.atas.length} ata(s)</strong>
                  </div>

                  <div className="saved-card-grid">
                    {chapter.atas.length ?(
                      chapter.atas.map((ata) => (
                        <article
                          className={`saved-card saved-card-clickable ${
                            generatingId === ata.id ?"is-generating" : ""
                          }`}
                          key={ata.id}
                          onClick={() => handleSavedAtaAction(ata)}
                          title={
                            ata.attachmentCount > 0
                              ?"Abrir no gerador para reenviar anexos"
                              : "Gerar PDF desta ata"
                          }
                        >
                          <div className="saved-card-topline">
                            <span>{ata.sociedade}</span>
                            <span>
                              {generatingId === ata.id
                                ?"Gerando PDF"
                                : `${ata.attachmentCount} anexo(s)`}
                            </span>
                          </div>
                          <h3>{ata.title}</h3>
                          <dl>
                            <div>
                              <dt>Arquivo</dt>
                              <dd>{ata.outputName}.pdf</dd>
                            </div>
                            <div>
                              <dt>Atualizada em</dt>
                              <dd>{formatDate(ata.updatedAt)}</dd>
                            </div>
                            <div>
                              <dt>Criada em</dt>
                              <dd>{formatDate(ata.createdAt)}</dd>
                            </div>
                          </dl>
                          <div className="saved-card-actions">
                            <button
                              className="soft-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleSavedAtaAction(ata);
                              }}
                              disabled={generatingId === ata.id}
                            >
                              {generatingId === ata.id
                                ?"Gerando..."
                                : ata.attachmentCount > 0
                                  ?"Reenviar anexos"
                                  : "Gerar PDF"}
                            </button>
                            <a
                              className="text-button standalone-link"
                              href={demoMode ?`/demo/atas/nova?ata=${ata.id}` : `/atas/nova?ata=${ata.id}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              Abrir no gerador
                            </a>
                            <button
                              className="text-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleRename(ata);
                              }}
                              disabled={renamingId === ata.id}
                            >
                              {renamingId === ata.id ?"Renomeando..." : "Renomear"}
                            </button>
                            <button
                              className="text-button danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(ata.id);
                              }}
                              disabled={deletingId === ata.id}
                            >
                              {deletingId === ata.id ?"Excluindo..." : "Excluir"}
                            </button>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-state saved-empty-state">
                        Nenhuma ata salva neste capítulo ainda.
                      </div>
                    )}
                  </div>
                </section>
              ))
            ) : (
              <div className="empty-state saved-empty-state">
                Seu usuário ainda não está associado a nenhum capítulo.
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export default SavedAtasPage;
