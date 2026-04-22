"use client";

import { useEffect, useState } from "react";

import { compileAtaPdfInBrowser } from "../lib/swiftlatex-client";

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

function createMemberForm(defaultChapter = "") {
  return {
    chapters: defaultChapter ? [defaultChapter] : [],
    name: "",
    password: "",
    username: "",
  };
}

function base64ToFile(contentBase64, fileName, mimeType) {
  if (!contentBase64) {
    return null;
  }

  const binary = window.atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName || "anexo.bin", {
    type: mimeType || "application/octet-stream",
  });
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
        file: storedAttachment?.contentBase64
          ? base64ToFile(storedAttachment.contentBase64, fileName, storedAttachment.mimeType)
          : null,
        fileName,
        id,
        legenda: item.legenda || storedAttachment?.legenda || "",
      };
    }),
    autor: savedForm.autor || "",
    data_elaboracao: savedForm.data_elaboracao || "",
    data_reuniao: savedForm.data_reuniao || "",
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
    sociedade: savedForm.sociedade || ata.sociedade || "CS",
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

function validateSavedAtaForm(form) {
  const missing = [];

  if (!form.data_elaboracao.trim()) missing.push("data da elaboracao");
  if (!form.autor.trim()) missing.push("autor");
  if (!form.data_reuniao.trim()) missing.push("data da reuniao");
  if (!form.local_reuniao.trim()) missing.push("local da reuniao");
  if (!form.membros.length) missing.push("ao menos um membro");
  if (!form.pautasText.trim()) missing.push("ao menos uma pauta");
  if (!form.resultadosText.trim()) missing.push("ao menos um resultado");
  if (form.anexos.some((item) => !item.file)) {
    missing.push("arquivos dos anexos salvos");
  }

  if (missing.length) {
    throw new Error(`Nao foi possivel gerar o PDF. Corrija: ${missing.join(", ")}.`);
  }
}

function SavedAtasPage() {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: true,
    setupRequired: false,
    user: null,
  });
  const [chapters, setChapters] = useState([]);
  const [atas, setAtas] = useState([]);
  const [users, setUsers] = useState([]);
  const [memberForm, setMemberForm] = useState(createMemberForm);
  const [status, setStatus] = useState({
    tone: "idle",
    text: "Carregando suas atas salvas.",
  });
  const [isLoadingAtas, setIsLoadingAtas] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);

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

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nao foi possivel verificar a autenticacao.");
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
        setChapters(Array.isArray(payload.chapters) ? payload.chapters : []);
        setMemberForm(createMemberForm(payload.user?.chapters?.[0] || ""));
      } catch (error) {
        if (active) {
          setAuth({
            loading: false,
            setupRequired: false,
            user: null,
          });
          setStatus({
            tone: "error",
            text: error.message || "Nao foi possivel verificar a autenticacao.",
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
    if (!auth.user) {
      return;
    }

    loadAtas();
    if (auth.user.isAdmin) {
      loadUsers();
    }
  }, [auth.user]);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const userChapterSet = new Set(auth.user?.chapters || []);
  const accessibleChapters = chapters.filter((chapter) => userChapterSet.has(chapter.key));
  const atasByChapter = accessibleChapters.map((chapter) => ({
    ...chapter,
    atas: atas.filter((ata) => ata.sociedade === chapter.key),
  }));

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function loadAtas() {
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
          text: "Sua sessao expirou. Entre novamente pelo gerador.",
        });
        return;
      }

      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel carregar as atas."));
      }

      const payload = await response.json();
      setAtas(Array.isArray(payload.atas) ? payload.atas : []);
      setStatus({
        tone: "success",
        text: "Lista de atas salvas atualizada.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel carregar as atas.",
      });
    } finally {
      setIsLoadingAtas(false);
    }
  }

  async function loadUsers() {
    setIsLoadingUsers(true);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel carregar membros."));
      }

      const payload = await response.json();
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel carregar membros.",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }

  function updateMemberField(field, value) {
    setMemberForm((current) => ({ ...current, [field]: value }));
  }

  function toggleMemberChapter(chapterKey) {
    setMemberForm((current) => {
      const selected = new Set(current.chapters);
      if (selected.has(chapterKey)) {
        selected.delete(chapterKey);
      } else {
        selected.add(chapterKey);
      }

      return {
        ...current,
        chapters: [...selected],
      };
    });
  }

  async function handleCreateMember(event) {
    event.preventDefault();
    setIsCreatingMember(true);
    setStatus({
      tone: "loading",
      text: "Cadastrando membro do capitulo.",
    });

    try {
      const response = await fetch("/api/users", {
        body: JSON.stringify(memberForm),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel cadastrar o membro."));
      }

      setMemberForm(createMemberForm(accessibleChapters[0]?.key || ""));
      await loadUsers();
      setStatus({
        tone: "success",
        text: "Membro cadastrado e associado ao(s) capitulo(s).",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel cadastrar o membro.",
      });
    } finally {
      setIsCreatingMember(false);
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
      const response = await fetch(`/api/atas/${ataId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel excluir a ata."));
      }

      setAtas((current) => current.filter((ata) => ata.id !== ataId));
      setStatus({
        tone: "success",
        text: "Ata removida do banco.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel excluir a ata.",
      });
    } finally {
      setDeletingId(null);
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
      const response = await fetch(`/api/atas/${ataId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel abrir a ata salva."));
      }

      const payload = await response.json();
      const form = createFormFromStoredAta(payload.ata);
      validateSavedAtaForm(form);

      const result = await compileAtaPdfInBrowser({
        form,
        outputName: payload.ata.outputName || payload.ata.title || "ata_preenchida",
      });
      baixarArquivo(result.pdf, result.fileName);
      setStatus({
        tone: "success",
        text: "PDF gerado a partir da ata salva. O download foi iniciado.",
      });
    } catch (error) {
      const message =
        error instanceof TypeError
          ? "Nao foi possivel inicializar o compilador no navegador."
          : error.message || "Nao foi possivel gerar o PDF da ata salva.";

      setStatus({
        tone: "error",
        text: message,
      });
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleLogout() {
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
          <p className="panel-kicker">Atas salvas</p>
          <h1>Carregando biblioteca</h1>
          <p>Verificando sua sessao local antes de abrir o banco de atas.</p>
        </section>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="app-shell auth-shell">
        {themeToggleButton}
        <section className="hero-panel auth-card">
          <p className="panel-kicker">Atas salvas</p>
          <h1>Acesso necessario</h1>
          <p>
            {auth.setupRequired
              ? "Crie o primeiro usuario pelo gerador antes de acessar o banco de atas."
              : "Entre pelo gerador para consultar suas atas salvas."}
          </p>
          <a className="primary-button standalone-link" href="/">
            Ir para o gerador
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/" className="site-brand" aria-label="Ir para o gerador">
          <span className="site-brand-badge" aria-hidden="true">
            AT
          </span>
          <span className="site-brand-lockup">
            <span className="site-brand-text">Atas IEEE</span>
            <span className="site-brand-meta">Banco de atas por capítulo</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Gerador</a></li>
          <li><a href="/atas" aria-current="page">Atas salvas</a></li>
        </ul>

        <div className="topbar-actions">
          <span className="user-chip">{auth.user.name}</span>
          <a className="ghost-button" href="/">
            Nova ata
          </a>
          <button className="ghost-button" onClick={loadAtas} disabled={isLoadingAtas}>
            Atualizar
          </button>
          <button className="ghost-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {themeToggleButton}

      <main className="page-main saved-page-main">
        <section className="hero-panel saved-hero">
          <div>
            <p className="panel-kicker">Banco interno</p>
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
        </section>

        <section className="panel saved-library">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Biblioteca</p>
              <h2>{atas.length ? `${atas.length} ata(s) nos seus capítulos` : "Nenhuma ata salva"}</h2>
            </div>
            <a className="soft-button standalone-link" href="/">
              Criar nova ata
            </a>
          </div>

          <div className="chapter-sections">
            {atasByChapter.length ? (
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
                    {chapter.atas.length ? (
                      chapter.atas.map((ata) => (
                        <article
                          className={`saved-card saved-card-clickable ${
                            generatingId === ata.id ? "is-generating" : ""
                          }`}
                          key={ata.id}
                          onClick={() => handleGenerateSavedAta(ata.id)}
                          title="Gerar PDF desta ata"
                        >
                          <div className="saved-card-topline">
                            <span>{ata.sociedade}</span>
                            <span>
                              {generatingId === ata.id
                                ? "Gerando PDF"
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
                                handleGenerateSavedAta(ata.id);
                              }}
                              disabled={generatingId === ata.id}
                            >
                              {generatingId === ata.id ? "Gerando..." : "Gerar PDF"}
                            </button>
                            <a
                              className="text-button standalone-link"
                              href={`/?ata=${ata.id}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              Abrir no gerador
                            </a>
                            <button
                              className="text-button danger"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(ata.id);
                              }}
                              disabled={deletingId === ata.id}
                            >
                              {deletingId === ata.id ? "Excluindo..." : "Excluir"}
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

        {auth.user.isAdmin ? (
          <section className="panel members-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Membros</p>
                <h2>Acessos por capítulo</h2>
              </div>
              <button className="soft-button" onClick={loadUsers} disabled={isLoadingUsers}>
                Atualizar membros
              </button>
            </div>

            <div className="members-layout">
              <form className="member-form" onSubmit={handleCreateMember}>
                <label className="field">
                  <span>Nome</span>
                  <input
                    value={memberForm.name}
                    onChange={(event) => updateMemberField("name", event.target.value)}
                    autoComplete="name"
                  />
                </label>

                <label className="field">
                  <span>Nome de usuário</span>
                  <input
                    value={memberForm.username}
                    onChange={(event) => updateMemberField("username", event.target.value)}
                    autoComplete="username"
                  />
                </label>

                <label className="field">
                  <span>Senha inicial</span>
                  <input
                    type="password"
                    value={memberForm.password}
                    onChange={(event) => updateMemberField("password", event.target.value)}
                    autoComplete="new-password"
                  />
                </label>

                <div className="chapter-checklist">
                  <span>Capítulos permitidos</span>
                  {chapters.map((chapter) => (
                    <label key={chapter.key}>
                      <input
                        type="checkbox"
                        checked={memberForm.chapters.includes(chapter.key)}
                        onChange={() => toggleMemberChapter(chapter.key)}
                      />
                      <strong>{chapter.key}</strong>
                      <small>{chapter.label}</small>
                    </label>
                  ))}
                </div>

                <button className="primary-button" disabled={isCreatingMember}>
                  {isCreatingMember ? "Cadastrando..." : "Cadastrar membro"}
                </button>
              </form>

              <div className="member-list">
                {users.length ? (
                  users.map((user) => (
                    <div className="member-row" key={user.id}>
                      <div>
                        <strong>{user.name}</strong>
                        <span>@{user.username}</span>
                      </div>
                      <div className="member-chips">
                        {user.isAdmin ? <span>Admin</span> : null}
                        {user.chapters.map((chapter) => (
                          <span key={chapter}>{chapter}</span>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    Nenhum membro carregado ainda.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default SavedAtasPage;
