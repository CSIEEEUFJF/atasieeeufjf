"use client";

import { useEffect, useState } from "react";

export default function AccessDeniedPage() {
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

  return (
    <div className="app-shell auth-shell">
      <section className="hero-panel auth-card">
        <p className="panel-kicker">Acesso negado</p>
        <h1>Acesso restrito</h1>
        <p>Esta área é exclusiva para a diretoria do Ramo e dos capítulos.</p>
        <a className="primary-button standalone-link" href="/tarefas">
          Voltar para tarefas
        </a>
      </section>
    </div>
  );
}
