"use client";

import { useEffect, useState } from "react";

import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

export default function AtaHubPage() {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({ loading: true, setupRequired: false, user: null });
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
  }, []);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function handleLogout() {
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
    return (
      <div className="app-shell auth-shell">
        {themeToggleButton}
        <section className="hero-panel auth-card">
          <p className="panel-kicker">Atas</p>
          <h1>Acesse sua conta</h1>
          <p>Entre para consultar o banco de atas ou criar uma nova ata.</p>
          <a className="primary-button standalone-link" href="/atas/nova?next=%2F">
            Entrar no sistema
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/" className="site-brand" aria-label="Ir para início">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Banco de atas por capítulo</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Início</a></li>
          <li><a href="/atas" aria-current="page">Atas</a></li>
          <li><a href="/tarefas">Tarefas</a></li>
          <li><a href="/calendario">Calendário</a></li>
          <li><a href="/diretoria">Diretoria</a></li>
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
      {isPasswordDialogOpen ?(
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
          <a className="board-action-card" href="/atas/banco">
            <span>Biblioteca</span>
            <strong>Consultar banco de atas</strong>
            <p>Acesse atas salvas por capítulo, anexos e registros já gerados.</p>
          </a>

          <a className="board-action-card" href="/atas/nova">
            <span>Gerador</span>
            <strong>Criar nova ata</strong>
            <p>Abra o formulário de geração para preencher reunião, presentes, pautas e resultados.</p>
          </a>
        </section>
      </main>
    </div>
  );
}
