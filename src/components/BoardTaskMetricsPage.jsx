"use client";

import { useEffect, useState } from "react";

import AccessDeniedPage from "./AccessDeniedPage";
import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";
import { DEMO_USER, createDemoMetrics } from "./demo-data";

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function totalize(chapters) {
  return chapters.reduce(
    (totals, chapter) => ({
      completed: totals.completed + Number(chapter.totals?.completed || 0),
      open: totals.open + Number(chapter.totals?.open || 0),
      registered: totals.registered + Number(chapter.totals?.registered || 0),
    }),
    { completed: 0, open: 0, registered: 0 },
  );
}

export default function BoardTaskMetricsPage({ demoMode = false } = {}) {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: !demoMode,
    setupRequired: false,
    user: demoMode ?DEMO_USER : null,
  });
  const [chapters, setChapters] = useState(demoMode ?createDemoMetrics : []);
  const [status, setStatus] = useState({
    tone: demoMode ?"success" : "idle",
    text: demoMode ?"Métricas demo carregadas com dados fictícios." : "Carregando métricas da diretoria.",
  });
  const [isLoading, setIsLoading] = useState(false);
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
      setAuth({ loading: false, setupRequired: false, user: DEMO_USER });
      setChapters(createDemoMetrics());
      setStatus({ tone: "success", text: "Métricas demo carregadas com dados fictícios." });
      return () => {
        active = false;
      };
    }

    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await readApiError(response, "Não foi possível verificar a autenticação."));
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
      } catch (error) {
        if (active) {
          setAuth({ loading: false, setupRequired: false, user: null });
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

    if (auth.user) {
      loadMetrics();
    }
  }, [auth.user, demoMode]);

  useEffect(() => {
    if (!demoMode && !auth.loading && !auth.user) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [auth.loading, auth.user, demoMode]);

  const nextTheme = theme === "dark" ?"light" : "dark";
  const totals = totalize(chapters);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ?"light" : "dark"));
  }

  async function loadMetrics() {
    if (demoMode) {
      setChapters(createDemoMetrics());
      setStatus({ tone: "success", text: "Métricas demo restauradas." });
      return;
    }

    setIsLoading(true);
    setStatus({ tone: "loading", text: "Atualizando métricas de tarefas." });

    try {
      const response = await fetch("/api/internal/task-metrics", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível carregar as métricas."));
      }

      const payload = await response.json();
      setChapters(Array.isArray(payload.chapters) ?payload.chapters : []);
      setStatus({ tone: "success", text: "Métricas atualizadas." });
    } catch (error) {
      setStatus({
        tone: "error",
        text: error.message || "Não foi possível carregar as métricas.",
      });
    } finally {
      setIsLoading(false);
    }
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

  if (!auth.user.canManageMembers) {
    return <AccessDeniedPage />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href={demoMode ?"/demo/diretoria" : "/diretoria"} className="site-brand" aria-label="Ir para diretoria">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Diretoria IEEE UFJF</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href={demoMode ?"/demo" : "/"}>Início</a></li>
          <li><a href={demoMode ?"/demo/atas" : "/atas"}>Atas</a></li>
          <li><a href={demoMode ?"/demo/tarefas" : "/tarefas"}>Tarefas</a></li>
          <li><a href={demoMode ?"/demo/calendario" : "/calendario"}>Calendário</a></li>
          <li><a href={demoMode ?"/demo/diretoria" : "/diretoria"} aria-current="page">Diretoria</a></li>
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
          <button className="ghost-button" onClick={loadMetrics} disabled={isLoading}>
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
        <UserPasswordDialog user={auth.user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main board-page-main">
        <section className="hero-panel internal-hero internal-hero--simple">
          <div>
            <p className="panel-kicker">Diretoria</p>
            <h1>Métricas de tarefas</h1>
            <p>
              Acompanhe tarefas registradas, concluídas e abertas por membro. Presidentes de
              capítulos veem seus capítulos; diretoria do Ramo vê todos separados por capítulo.
            </p>
          </div>
        </section>

        <section className="internal-summary-strip" aria-label="Resumo geral">
          <div>
            <span>Registradas</span>
            <strong>{totals.registered}</strong>
          </div>
          <div>
            <span>Concluídas</span>
            <strong>{totals.completed}</strong>
          </div>
          <div>
            <span>Abertas</span>
            <strong>{totals.open}</strong>
          </div>
        </section>

        <section className="board-chapter-list">
          {chapters.length ?(
            chapters.map((chapter) => (
              <article className="panel board-chapter-panel" key={chapter.chapter}>
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">{chapter.chapter}</p>
                    <h2>{chapter.label}</h2>
                  </div>
                  <div className="board-chapter-totals">
                    <span>{chapter.totals.registered} registradas</span>
                    <span>{chapter.totals.completed} concluídas</span>
                    <span>{chapter.totals.open} abertas</span>
                  </div>
                </div>

                <div className="member-metrics-list">
                  {chapter.members.length ?(
                    chapter.members.map((metric) => (
                      <div className="member-metrics-row" key={`${chapter.chapter}-${metric.id}`}>
                        <strong>{metric.name}</strong>
                        <span>
                          <small>Registradas</small>
                          {metric.registered}
                        </span>
                        <span>
                          <small>Concluídas</small>
                          {metric.completed}
                        </span>
                        <span>
                          <small>Abertas</small>
                          {metric.open}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">Nenhum membro neste capítulo.</div>
                  )}
                </div>
              </article>
            ))
          ) : (
            <section className="panel">
              <div className="empty-state">Nenhuma métrica disponível para sua permissão.</div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
