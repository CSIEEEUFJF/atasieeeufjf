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

function createInitialAuthForm() {
  return {
    name: "",
    password: "",
    username: "",
  };
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

export default function HomeDashboard({ demoMode = false } = {}) {
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
    text: "Entre para acessar o sistema interno.",
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
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
      setAuthMessage({
        tone: "success",
        text: "Modo demo aberto com dados fictícios.",
      });
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
          setAuthMode(payload.setupRequired ? "setup" : "login");
          setAuthMessage({
            tone: "idle",
            text: payload.setupRequired
              ? "Crie o primeiro acesso para liberar o sistema."
              : "Entre para acessar o sistema interno.",
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

  function updateAuthField(field, value) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthMessage({
      tone: "loading",
      text: authMode === "setup" ? "Criando usuário inicial..." : "Entrando...",
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

  if (auth.loading) {
    return <LoadingBall />;
  }

  if (!auth.user) {
    return <LoadingBall />;
  }

  const actions = [
    {
      href: demoMode ?"/demo/atas" : "/atas",
      kicker: "Atas",
      title: "Banco e geração de atas",
      text: "Consulte atas salvas ou crie uma nova ata de reunião.",
    },
    {
      href: demoMode ?"/demo/tarefas" : "/tarefas",
      kicker: "Demandas",
      title: "Tarefas",
      text: "Acompanhe tarefas abertas, responsáveis, prioridades e prazos.",
    },
    {
      href: demoMode ?"/demo/calendario" : "/calendario",
      kicker: "Agenda",
      title: "Calendário",
      text: "Veja os horários agendados e eventos do Ramo e dos capítulos.",
    },
    {
      href: demoMode ?"/demo/diretoria" : "/diretoria",
      kicker: "Gestão",
      title: "Diretoria",
      text: "Acesse métricas, membros e controles restritos de gestão.",
    },
  ];
  const visibleActions = actions.filter((action) => (
    demoMode || !action.href.endsWith("/diretoria") || auth.user.canManageMembers
  ));

  return (
    <div className="app-shell">
      <header className="site-nav home-site-nav">
        <a href={demoMode ?"/demo" : "/"} className="home-branch-brand" aria-label="Ir para início">
          <span className="home-branch-logo" aria-hidden="true" />
          <span className="home-branch-lockup">
            <span>Universidade Federal de Juiz de Fora</span>
            <strong>IEEE Student Branch</strong>
          </span>
          <span className="home-branch-divider" aria-hidden="true" />
          <span className="home-system-title">Sistema Interno</span>
        </a>

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

      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {!demoMode && isPasswordDialogOpen ?(
        <UserPasswordDialog user={auth.user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main board-page-main">
        <section className="hero-panel internal-hero internal-hero--simple">
          <div>
            <p className="panel-kicker">Início</p>
            <h1>Bem vindo, {auth.user.name}</h1>
            <p>
              {demoMode
                ?"Explore o sistema interno com dados fictícios, sem alterar o ambiente real."
                : "Escolha uma área do sistema interno para continuar."}
            </p>
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
