"use client";

import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [theme, setTheme] = useState("light");

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

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/" className="site-brand" aria-label="Ir para início">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Serviço de dados</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Início</a></li>
        </ul>
      </header>

      <button
        type="button"
        className="theme-toggle"
        data-theme-current={theme}
        onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        aria-pressed={theme === "dark"}
        aria-label={`Alternar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
        title={`Trocar para tema ${nextTheme === "dark" ? "escuro" : "claro"}`}
      >
        <span className="theme-toggle__icon" aria-hidden="true" />
        <span className="theme-toggle__label">
          {theme === "dark" ? "Tema escuro" : "Tema claro"}
        </span>
      </button>

      <main className="page-main offline-main">
        <section className="hero-panel offline-card">
          <div className="offline-content">
            <p className="panel-kicker">Serviço de dados offline</p>
            <h1>Não foi possível conectar ao armazenamento</h1>
            <p>Não foi possível conectar ao servidor</p>
          </div>

          <div className="offline-actions">
            <a className="primary-button" href="/arquivos">
              Tentar novamente
            </a>
            <a className="soft-button" href="/">
              Voltar ao início
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
