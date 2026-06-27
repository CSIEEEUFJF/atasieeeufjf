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

function ThemeToggle({ theme, onToggle }) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      data-theme-current={theme}
      onClick={onToggle}
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
}

export default function HomeDashboard() {
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

  if (auth.loading) {
    return <LoadingBall />;
  }

  if (!auth.user) {
    return (
      <div className="app-shell auth-shell">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <section className="hero-panel auth-card">
          <p className="panel-kicker">Sistema interno</p>
          <h1>Acesse sua conta</h1>
          <p>Entre para acessar tarefas, calendário, atas e área da diretoria.</p>
          <a className="primary-button standalone-link" href="/atas/nova?next=%2F">
            Entrar no sistema
          </a>
        </section>
      </div>
    );
  }

  const actions = [
    {
      href: "/atas",
      kicker: "Atas",
      title: "Banco e geração de atas",
      text: "Consulte atas salvas ou crie uma nova ata de reunião.",
    },
    {
      href: "/tarefas",
      kicker: "Demandas",
      title: "Tarefas",
      text: "Acompanhe tarefas abertas, responsáveis, prioridades e prazos.",
    },
    {
      href: "/calendario",
      kicker: "Agenda",
      title: "Calendário",
      text: "Veja os horários agendados e eventos do Ramo e dos capítulos.",
    },
    {
      href: "/diretoria",
      kicker: "Gestão",
      title: "Diretoria",
      text: "Acesse métricas, membros e controles restritos de gestão.",
    },
  ];
  const visibleActions = actions.filter((action) => (
    action.href !== "/diretoria" || auth.user.canManageMembers
  ));

  return (
    <div className="app-shell">
      <header className="site-nav home-site-nav">
        <a href="/" className="home-branch-brand" aria-label="Ir para início">
          <span className="home-branch-logo" aria-hidden="true" />
          <span className="home-branch-lockup">
            <span>Universidade Federal de Juiz de Fora</span>
            <strong>IEEE Student Branch</strong>
          </span>
          <span className="home-branch-divider" aria-hidden="true" />
          <span className="home-system-title">Sistema Interno</span>
        </a>

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

      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {isPasswordDialogOpen ?(
        <UserPasswordDialog user={auth.user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main board-page-main">
        <section className="hero-panel internal-hero internal-hero--simple">
          <div>
            <p className="panel-kicker">Início</p>
            <h1>Bem vindo, {auth.user.name}</h1>
            <p>Escolha uma área do sistema interno para continuar.</p>
          </div>
        </section>

        <section className="board-action-grid home-action-grid">
          {visibleActions.map((action) => (
            <a className="board-action-card" href={action.href} key={action.href}>
              <span>{action.kicker}</span>
              <strong>{action.title}</strong>
              <p>{action.text}</p>
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}
