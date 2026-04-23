"use client";

import { useEffect, useState } from "react";

import UserPasswordDialog from "./UserPasswordDialog";

const ROLE_OPTIONS = [
  "Presidente",
  "Vice-presidente",
  "Secretario",
  "Tesoureiro",
  "Diretor",
  "Coordenador",
  "Representante",
  "Membro",
];

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function createMemberForm(defaultChapter = "") {
  return {
    cargo: "",
    chapters: defaultChapter ? [defaultChapter] : [],
    isAdmin: false,
    name: "",
    password: "",
    username: "",
  };
}

function normalizeChapterRoles(chapterRoles) {
  if (!chapterRoles || typeof chapterRoles !== "object" || Array.isArray(chapterRoles)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(chapterRoles)
      .map(([chapterKey, cargo]) => [chapterKey, String(cargo || "").trim()])
      .filter(([, cargo]) => cargo),
  );
}

function createChapterRolesDraft(user) {
  const roles = normalizeChapterRoles(user.chapterRoles);
  const fallbackCargo = user.cargo || "";
  const hasSpecificRoles = Object.keys(roles).length > 0;
  const userChapters = Array.isArray(user.chapters) ? user.chapters : [];

  return Object.fromEntries(
    userChapters.map((chapterKey) => [
      chapterKey,
      roles[chapterKey] || (hasSpecificRoles ? "" : fallbackCargo),
    ]),
  );
}

function createUserDraft(user) {
  const chapterRoles = createChapterRolesDraft(user);

  return {
    cargo: Object.values(chapterRoles).find(Boolean) || user.cargo || "",
    chapterRoles,
    chapters: Array.isArray(user.chapters) ? user.chapters : [],
    isAdmin: Boolean(user.isAdmin),
    name: user.name || "",
  };
}

function hydrateDrafts(users) {
  return Object.fromEntries(users.map((user) => [user.id, createUserDraft(user)]));
}

function roleOptionsFor(value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue || ROLE_OPTIONS.includes(cleanValue)) {
    return ROLE_OPTIONS;
  }

  return [...ROLE_OPTIONS, cleanValue];
}

function selectedChaptersForDraft(draft, chapters) {
  return draft.isAdmin ? chapters.map((chapter) => chapter.key) : draft.chapters || [];
}

function chapterRolesForPayload(draft, selectedChapters) {
  const selected = new Set(selectedChapters);
  const roles = normalizeChapterRoles(draft.chapterRoles);

  return Object.fromEntries(
    Object.entries(roles).filter(([chapterKey]) => selected.has(chapterKey)),
  );
}

function primaryCargoFromRoles(chapterRoles, selectedChapters, fallback = "") {
  const roles = normalizeChapterRoles(chapterRoles);
  return selectedChapters.map((chapterKey) => roles[chapterKey]).find(Boolean) || fallback || "";
}

export default function MembersPage() {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: true,
    setupRequired: false,
    user: null,
  });
  const [chapters, setChapters] = useState([]);
  const [users, setUsers] = useState([]);
  const [memberForm, setMemberForm] = useState(createMemberForm);
  const [userDrafts, setUserDrafts] = useState({});
  const [status, setStatus] = useState({
    tone: "idle",
    text: "Carregando gestao de membros.",
  });
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingMember, setIsCreatingMember] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
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

        const currentUser = payload.user || null;
        const chapterOptions = Array.isArray(payload.chapters) ? payload.chapters : [];
        setAuth({
          loading: false,
          setupRequired: Boolean(payload.setupRequired),
          user: currentUser,
        });
        setChapters(chapterOptions);
        setMemberForm(createMemberForm(currentUser?.chapters?.[0] || chapterOptions[0]?.key || ""));
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
    if (auth.user?.isAdmin) {
      loadUsers();
    }
  }, [auth.user]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function loadUsers() {
    setIsLoadingUsers(true);
    setStatus({ tone: "loading", text: "Atualizando membros cadastrados." });

    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel carregar membros."));
      }

      const payload = await response.json();
      const nextUsers = Array.isArray(payload.users) ? payload.users : [];
      setUsers(nextUsers);
      setUserDrafts(hydrateDrafts(nextUsers));
      setStatus({ tone: "success", text: "Membros atualizados." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel carregar membros.",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
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

      return { ...current, chapters: [...selected] };
    });
  }

  function updateUserDraft(userId, field, value) {
    setUserDrafts((current) => ({
      ...current,
      [userId]: {
        ...(current[userId] || {}),
        [field]: value,
      },
    }));
  }

  function toggleUserDraftChapter(userId, chapterKey) {
    setUserDrafts((current) => {
      const draft = current[userId] || {};
      const selected = new Set(draft.chapters || []);
      const chapterRoles = { ...(draft.chapterRoles || {}) };
      if (selected.has(chapterKey)) {
        selected.delete(chapterKey);
        delete chapterRoles[chapterKey];
      } else {
        selected.add(chapterKey);
        chapterRoles[chapterKey] = chapterRoles[chapterKey] || draft.cargo || "";
      }

      return {
        ...current,
        [userId]: {
          ...draft,
          chapterRoles,
          chapters: [...selected],
        },
      };
    });
  }

  function updateUserDraftChapterRole(userId, chapterKey, cargo) {
    setUserDrafts((current) => {
      const draft = current[userId] || {};
      const chapterRoles = {
        ...(draft.chapterRoles || {}),
        [chapterKey]: cargo,
      };
      const selected = new Set(draft.chapters || []);
      if (cargo) {
        selected.add(chapterKey);
      }

      return {
        ...current,
        [userId]: {
          ...draft,
          cargo: primaryCargoFromRoles(chapterRoles, [...selected], ""),
          chapterRoles,
          chapters: [...selected],
        },
      };
    });
  }

  async function handleCreateMember(event) {
    event.preventDefault();
    setIsCreatingMember(true);
    setStatus({
      tone: "loading",
      text: memberForm.isAdmin ? "Cadastrando novo administrador." : "Cadastrando membro.",
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

      setMemberForm(createMemberForm(auth.user?.chapters?.[0] || chapters[0]?.key || ""));
      await loadUsers();
      setStatus({
        tone: "success",
        text: memberForm.isAdmin
          ? "Administrador cadastrado com acesso a todos os capitulos."
          : "Membro cadastrado.",
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

  async function handleSaveUser(user) {
    const draft = userDrafts[user.id] || createUserDraft(user);
    const selectedChapters = selectedChaptersForDraft(draft, chapters);
    const chapterRoles = chapterRolesForPayload(draft, selectedChapters);
    const payload = {
      cargo: primaryCargoFromRoles(chapterRoles, selectedChapters, ""),
      chapterRoles,
      chapters: selectedChapters,
      name: draft.name,
    };

    if (user.id !== auth.user.id) {
      payload.isAdmin = Boolean(draft.isAdmin);
    }

    setSavingUserId(user.id);
    setStatus({ tone: "loading", text: "Salvando alteracoes do membro." });

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel atualizar o membro."));
      }

      const data = await response.json();
      setUsers((current) => current.map((item) => (item.id === user.id ? data.user || item : item)));
      if (user.id === auth.user.id && data.user) {
        setAuth((current) => ({ ...current, user: data.user }));
      }
      setUserDrafts((current) => ({
        ...current,
        [user.id]: createUserDraft(data.user || user),
      }));
      setStatus({ tone: "success", text: "Usuario atualizado." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Nao foi possivel atualizar o membro.",
      });
    } finally {
      setSavingUserId(null);
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
          <p className="panel-kicker">Membros</p>
          <h1>Carregando gestao</h1>
          <p>Verificando sua sessao antes de abrir o painel de membros.</p>
        </section>
      </div>
    );
  }

  if (!auth.user || !auth.user.isAdmin) {
    return (
      <div className="app-shell auth-shell">
        {themeToggleButton}
        <section className="hero-panel auth-card">
          <p className="panel-kicker">Membros</p>
          <h1>Acesso de administrador necessario</h1>
          <p>
            {auth.setupRequired
              ? "Crie o primeiro usuario pelo gerador antes de gerenciar membros."
              : "Entre com um usuario administrador para gerenciar membros e cargos."}
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
            <span className="site-brand-meta">Gestao de membros</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Gerador</a></li>
          <li><a href="/atas">Atas salvas</a></li>
          <li><a href="/membros" aria-current="page">Membros</a></li>
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

      <main className="page-main members-page-main">
        <section className="hero-panel members-hero">
          <div>
            <p className="panel-kicker">Acessos</p>
            <h1>Gestao de membros</h1>
            <p>
              Cadastre usuarios, defina cargo/função por sociedade e controle acesso por capitulo.
              O cargo cadastrado aparece no gerador conforme a sociedade escolhida.
            </p>
          </div>
          <div className={`status-box tone-${status.tone}`}>
            <span>Status</span>
            <strong>{status.text}</strong>
          </div>
        </section>

        <section className="members-layout">
          <article className="panel member-create-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Novo acesso</p>
                <h2>Cadastrar membro</h2>
              </div>
            </div>

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
                <span>Cargo / função padrão</span>
                <select
                  value={memberForm.cargo}
                  onChange={(event) => updateMemberField("cargo", event.target.value)}
                >
                  <option value="">Sem cargo definido</option>
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
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

              <label className="member-admin-toggle">
                <input
                  type="checkbox"
                  checked={memberForm.isAdmin}
                  onChange={(event) => updateMemberField("isAdmin", event.target.checked)}
                />
                <span>
                  <strong>Criar como administrador</strong>
                  <small>Admins podem gerenciar membros e acessam todos os capitulos.</small>
                </span>
              </label>

              <div className="chapter-checklist">
                <span>Capitulos permitidos</span>
                {chapters.map((chapter) => (
                  <label key={chapter.key}>
                    <input
                      type="checkbox"
                      checked={memberForm.isAdmin || memberForm.chapters.includes(chapter.key)}
                      disabled={memberForm.isAdmin}
                      onChange={() => toggleMemberChapter(chapter.key)}
                    />
                    <strong>{chapter.key}</strong>
                    <small>{chapter.label}</small>
                  </label>
                ))}
              </div>

              <button className="primary-button" disabled={isCreatingMember}>
                {isCreatingMember
                  ? "Cadastrando..."
                  : memberForm.isAdmin
                    ? "Cadastrar admin"
                    : "Cadastrar membro"}
              </button>
            </form>
          </article>

          <article className="panel members-list-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Cadastrados</p>
                <h2>{users.length ? `${users.length} usuario(s)` : "Nenhum usuario carregado"}</h2>
              </div>
              <button className="soft-button" onClick={loadUsers} disabled={isLoadingUsers}>
                Atualizar
              </button>
            </div>

            <div className="member-list">
              {users.length ? (
                users.map((user) => {
                  const draft = userDrafts[user.id] || createUserDraft(user);
                  const isSelf = user.id === auth.user.id;
                  const selectedChapterKeys = selectedChaptersForDraft(draft, chapters);
                  const selectedChapterCount = selectedChapterKeys.length;

                  return (
                    <div className="member-row" key={user.id}>
                      <div className="member-row-header">
                        <div>
                          <strong>{user.name}</strong>
                          <span>@{user.username}</span>
                        </div>
                        <div className="member-row-meta">
                          {user.isAdmin ? <span className="member-pill">Admin</span> : null}
                          <span className="member-pill member-pill-muted">
                            {selectedChapterCount} sociedade(s)
                          </span>
                        </div>
                      </div>

                      <div className="member-edit-grid">
                        <label className="field">
                          <span>Nome</span>
                          <input
                            value={draft.name}
                            onChange={(event) => updateUserDraft(user.id, "name", event.target.value)}
                          />
                        </label>

                        <label className="member-admin-toggle compact">
                          <input
                            type="checkbox"
                            checked={draft.isAdmin}
                            disabled={isSelf}
                            onChange={(event) => updateUserDraft(user.id, "isAdmin", event.target.checked)}
                          />
                          <span>
                            <strong>Administrador</strong>
                            <small>{isSelf ? "Voce nao pode alterar sua propria permissao." : "Concede acesso a gestao."}</small>
                          </span>
                        </label>
                      </div>

                      <details className="member-society-editor">
                        <summary>
                          <span>Sociedades</span>
                          <small>
                            {selectedChapterCount
                              ? `${selectedChapterCount} habilitada(s). Clique para editar acesso e cargo.`
                              : "Clique para habilitar sociedades e cargos."}
                          </small>
                        </summary>

                        <div className="chapter-role-grid">
                          {chapters.map((chapter) => {
                            const chapterEnabled = draft.isAdmin || draft.chapters.includes(chapter.key);
                            const roleValue = draft.chapterRoles?.[chapter.key] || "";

                            return (
                              <div
                                className={`chapter-role-row ${chapterEnabled ? "is-enabled" : ""}`}
                                key={chapter.key}
                              >
                                <label className="chapter-role-access">
                                  <input
                                    type="checkbox"
                                    checked={chapterEnabled}
                                    disabled={draft.isAdmin}
                                    onChange={() => toggleUserDraftChapter(user.id, chapter.key)}
                                  />
                                  <span>
                                    <strong>{chapter.key}</strong>
                                    <small>{chapter.label}</small>
                                  </span>
                                </label>

                                <label className="field chapter-role-field">
                                  <span>Cargo em {chapter.key}</span>
                                  <select
                                    value={roleValue}
                                    disabled={!chapterEnabled}
                                    onChange={(event) =>
                                      updateUserDraftChapterRole(
                                        user.id,
                                        chapter.key,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    <option value="">Sem cargo</option>
                                    {roleOptionsFor(roleValue).map((role) => (
                                      <option key={role} value={role}>
                                        {role}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </details>

                      <div className="inline-actions">
                        <button
                          className="soft-button"
                          type="button"
                          onClick={() => handleSaveUser(user)}
                          disabled={savingUserId === user.id}
                        >
                          {savingUserId === user.id ? "Salvando..." : "Salvar neste usuario"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">
                  Nenhum membro carregado ainda.
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
