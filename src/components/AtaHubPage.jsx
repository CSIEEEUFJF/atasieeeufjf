"use client";

import { useEffect, useState } from "react";

import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";
import { DEMO_USER } from "./demo-data";

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

export default function AtaHubPage({ demoMode = false } = {}) {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({
    loading: !demoMode,
    setupRequired: false,
    user: demoMode ?DEMO_USER : null,
  });
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
        if (active) {
          setAuth({
            loading: false,
            setupRequired: Boolean(payload.setupRequired),
            user: payload.user || null,
          });
        }
      } catch {
        if (active) {
          setAuth({ loading: false, setupRequired: false, user: null });
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

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
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

  const nextTheme = theme === "dark" ? "light" : "dark";
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
    return <LoadingBall />;
  }

  if (!auth.user) {
    return <LoadingBall />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href={demoMode ?"/demo/atas" : "/"} className="site-brand" aria-label="Ir para início">
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
          <li><a href={demoMode ?"/demo/diretoria" : "/diretoria"}>Diretoria</a></li>
        </ul>

        <div className="topbar-actions">
          {demoMode ?(
            <span className="user-chip">Modo demo</span>
          ) : (
            <>
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
            </>
          )}
        </div>
      </header>

      {themeToggleButton}
      {!demoMode && isPasswordDialogOpen ?(
        <UserPasswordDialog user={auth.user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main board-page-main">
        <section className="hero-panel internal-hero internal-hero--simple">
          <div>
            <p className="panel-kicker">Atas</p>
            <h1>O que você deseja fazer?</h1>
            <p>Escolha entre consultar atas já salvas ou iniciar uma nova ata de reunião.</p>
          </div>
        </section>

        <section className="board-action-grid">
          <a className="board-action-card" href={demoMode ?"/demo/atas/banco" : "/atas/banco"}>
            <span>Biblioteca</span>
            <strong>Consultar banco de atas</strong>
            <p>Acesse atas salvas por capítulo, anexos e registros já gerados.</p>
          </a>

          <a className="board-action-card" href={demoMode ?"/demo/atas/nova" : "/atas/nova"}>
            <span>Gerador</span>
            <strong>Criar nova ata</strong>
            <p>Abra o formulário de geração para preencher reunião, presentes, pautas e resultados.</p>
          </a>
        </section>
      </main>
    </div>
  );
}
