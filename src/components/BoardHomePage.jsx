"use client";

import { useEffect, useState } from "react";

import AccessDeniedPage from "./AccessDeniedPage";
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

export default function BoardHomePage() {
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
        }
      }
    }

    loadAuth();
    return () => {
      active = false;
    };
  }, []);

  const nextTheme = theme === "dark" ?"light" : "dark";

  function toggleTheme() {
    setTheme((current) => (current === "dark" ?"light" : "dark"));
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
    return <AccessDeniedPage />;
  }

  if (!auth.user.canManageMembers) {
    return <AccessDeniedPage />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/diretoria" className="site-brand" aria-label="Ir para diretoria">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Diretoria IEEE UFJF</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Início</a></li>
          <li><a href="/atas">Atas</a></li>
          <li><a href="/tarefas">Tarefas</a></li>
          <li><a href="/calendario">Calendário</a></li>
          <li><a href="/diretoria" aria-current="page">Diretoria</a></li>
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
            <p className="panel-kicker">Diretoria</p>
            <h1>Area da diretoria</h1>
            <p>
              Acesse os paineis restritos para acompanhar desempenho de tarefas e cadastrar
              novos membros do Ramo e dos capítulos.
            </p>
          </div>
        </section>

        <section className="board-action-grid">
          <a className="board-action-card" href="/diretoria/tarefas">
            <span>Métricas</span>
            <strong>Tarefas por membro</strong>
            <p>Veja tarefas registradas, concluídas e abertas por membro, separadas por capítulo.</p>
          </a>

          <a className="board-action-card" href="/diretoria/membros">
            <span>Cadastro</span>
            <strong>Membros e acessos</strong>
            <p>Cadastre novos membros, defina capítulos, cargos e permissões de diretoria.</p>
          </a>
        </section>
      </main>
    </div>
  );
}
