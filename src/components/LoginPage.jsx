"use client";

import { useEffect, useState } from "react";

import LoadingBall from "./LoadingBall";
import LoginShell from "./LoginShell";

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

function getSafeNextPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  const next = new URLSearchParams(window.location.search).get("next");
  if (!next) {
    return "/";
  }

  try {
    const url = new URL(next, window.location.origin);
    const forbiddenPath =
      url.pathname === "/login" ||
      url.pathname.startsWith("/login/") ||
      url.pathname.startsWith("/api") ||
      url.pathname.startsWith("/_next");

    if (url.origin !== window.location.origin || forbiddenPath) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

function ThemeToggle({ theme, onToggle }) {
  const nextTheme = theme === "dark" ?"light" : "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      data-theme-current={theme}
      onClick={onToggle}
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
}

export default function LoginPage() {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({ loading: true, setupRequired: false, user: null });
  const [authForm, setAuthForm] = useState(createInitialAuthForm);
  const [authMode, setAuthMode] = useState("login");
  const [authMessage, setAuthMessage] = useState({
    tone: "idle",
    text: "Digite seu usu\u00e1rio e senha.",
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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
          throw new Error(await readApiError(response, "N\u00e3o foi poss\u00edvel verificar a autentica\u00e7\u00e3o."));
        }

        const payload = await response.json();
        if (!active) {
          return;
        }

        if (payload.user) {
          window.location.replace(getSafeNextPath());
          return;
        }

        setAuth({
          loading: false,
          setupRequired: Boolean(payload.setupRequired),
          user: null,
        });
        setAuthMode(payload.setupRequired ?"setup" : "login");
        setAuthMessage({
          tone: "idle",
          text: payload.setupRequired
            ?"Crie o primeiro acesso para liberar o sistema."
            : "Digite seu usu\u00e1rio e senha.",
        });
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
    setTheme((current) => (current === "dark" ?"light" : "dark"));
  }

  function updateAuthField(field, value) {
    setAuthForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const loginIdentifier = authForm.username || authForm.name;
    const authPayload = authMode === "login"
      ? { ...authForm, name: loginIdentifier, username: loginIdentifier }
      : authForm;
    setIsAuthenticating(true);
    setAuthMessage({
      tone: "loading",
      text: authMode === "setup" ?"Criando usu\u00e1rio inicial..." : "Entrando...",
    });

    try {
      const response = await fetch(`/api/auth/${authMode === "setup" ?"setup" : "login"}`, {
        body: JSON.stringify(authPayload),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "N\u00e3o foi poss\u00edvel autenticar."));
      }

      setAuthForm(createInitialAuthForm());
      setAuthMessage({
        tone: "success",
        text: "Acesso liberado.",
      });
      window.location.replace(getSafeNextPath());
    } catch (error) {
      setAuthMessage({
        tone: "error",
        text: error.message || "N\u00e3o foi poss\u00edvel autenticar.",
      });
    } finally {
      setIsAuthenticating(false);
    }
  }

  if (auth.loading) {
    return <LoadingBall />;
  }

  const isSetup = authMode === "setup";

  return (
    <LoginShell
      authForm={authForm}
      description={
        isSetup
          ?"Este usu\u00e1rio ser\u00e1 o primeiro administrador do sistema."
          : "Digite seu usu\u00e1rio e senha."
      }
      isSetup={isSetup}
      isSubmitting={isAuthenticating}
      message={authMessage}
      onFieldChange={updateAuthField}
      onSubmit={handleAuthSubmit}
      submitLabel={isSetup ?"Criar acesso" : "Entrar"}
      submittingLabel={isSetup ?"Criando acesso..." : "Entrando..."}
      themeToggle={<ThemeToggle theme={theme} onToggle={toggleTheme} />}
      title={isSetup ?"Crie o primeiro acesso" : "Entre na sua conta"}
    />
  );
}
