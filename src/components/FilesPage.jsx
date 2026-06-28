"use client";

import { useEffect, useState } from "react";

import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";

async function readApiError(response, fallback) {
  try {
    const payload = await response.json();
    if (response.status === 503 && payload.code === "storage_unavailable") {
      window.location.href = "/offline";
      return payload.detail || "Serviço de dados indisponível.";
    }
    return payload.detail || fallback;
  } catch {
    return fallback;
  }
}

function formatBytes(size) {
  const value = Number(size || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date).replace(",", "");
}

export default function FilesPage() {
  const [theme, setTheme] = useState("light");
  const [auth, setAuth] = useState({ loading: true, user: null });
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState({ tone: "idle", text: "Carregando arquivos." });
  const [isStorageDisabled, setIsStorageDisabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
    async function loadAuth() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Não foi possível verificar a autenticação.");
        }

        const payload = await response.json();
        if (!active) return;
        setAuth({ loading: false, user: payload.user || null });
      } catch {
        if (active) {
          setAuth({ loading: false, user: null });
        }
      }
    }

    loadAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      window.location.replace(`/login?next=${encodeURIComponent("/arquivos")}`);
    }
  }, [auth.loading, auth.user]);

  useEffect(() => {
    if (auth.user) {
      loadFiles();
    }
  }, [auth.user]);

  const nextTheme = theme === "dark" ? "light" : "dark";

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  async function loadFiles() {
    setIsLoading(true);
    setStatus({ tone: "loading", text: "Atualizando arquivos." });
    try {
      const response = await fetch("/api/internal/files", { cache: "no-store" });
      if (response.status === 503) {
        const payload = await response.json().catch(() => ({}));
        if (payload.code === "storage_disabled") {
          setIsStorageDisabled(true);
          setFiles([]);
          setStatus({
            tone: "error",
            text: payload.detail || "Armazenamento desabilitado por enquanto.",
          });
          return;
        }
        if (payload.code === "storage_unavailable") {
          window.location.href = "/offline";
          return;
        }
      }

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível carregar arquivos."));
      }

      const payload = await response.json();
      setIsStorageDisabled(false);
      setFiles(Array.isArray(payload.files) ? payload.files : []);
      setStatus({ tone: "success", text: "Arquivos atualizados." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível carregar arquivos." });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (isStorageDisabled) {
      setStatus({ tone: "error", text: "Armazenamento desabilitado por enquanto." });
      return;
    }

    if (!selectedFiles.length) {
      setStatus({ tone: "error", text: "Selecione pelo menos um arquivo." });
      return;
    }

    setIsUploading(true);
    setStatus({ tone: "loading", text: "Enviando arquivo." });
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      formData.append("description", description);
      const response = await fetch("/api/internal/files", {
        body: formData,
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível enviar o arquivo."));
      }

      const payload = await response.json();
      const savedFiles = Array.isArray(payload.files) ? payload.files : [payload.file].filter(Boolean);
      setFiles((current) => [...savedFiles, ...current].filter(Boolean));
      setSelectedFiles([]);
      setDescription("");
      event.currentTarget.reset();
      setStatus({ tone: "success", text: savedFiles.length === 1 ? "Arquivo enviado." : "Arquivos enviados." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível enviar o arquivo." });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(file) {
    if (!window.confirm(`Remover ${file.originalName}?`)) {
      return;
    }

    setStatus({ tone: "loading", text: "Removendo arquivo." });
    try {
      const response = await fetch(`/api/internal/files/${file.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível remover o arquivo."));
      }

      setFiles((current) => current.filter((item) => item.id !== file.id));
      setStatus({ tone: "success", text: "Arquivo removido." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível remover o arquivo." });
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

  if (auth.loading || !auth.user) {
    return <LoadingBall />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/arquivos" className="site-brand" aria-label="Ir para arquivos">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Arquivos pessoais</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Início</a></li>
          <li><a href="/atas">Atas</a></li>
          <li><a href="/tarefas">Tarefas</a></li>
          <li><a href="/calendario">Calendário</a></li>
          <li><a href="/arquivos" aria-current="page">Arquivos</a></li>
          {auth.user.canManageMembers ? <li><a href="/diretoria">Diretoria</a></li> : null}
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
          <button className="ghost-button" onClick={loadFiles} disabled={isLoading}>
            Atualizar
          </button>
          <button className="ghost-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {themeToggleButton}
      {isPasswordDialogOpen ? (
        <UserPasswordDialog user={auth.user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main files-page-main">
        <section className="hero-panel members-hero">
          <div>
            <p className="panel-kicker">Arquivos</p>
            <h1>Armazenamento pessoal</h1>
            <p>
              Envie documentos, imagens, arquivos LaTeX e pacotes de projeto. Os arquivos ficam
              separados por usuário e só podem ser baixados pela sua própria conta.
            </p>
          </div>
          <div className={`status-box tone-${status.tone}`}>
            <span>Status</span>
            <strong>{status.text}</strong>
          </div>
        </section>

        <section className="files-layout">
          <article className="panel file-upload-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Upload</p>
                <h2>Enviar arquivo</h2>
              </div>
            </div>
            {isStorageDisabled ? (
              <div className="empty-state">
                O armazenamento de arquivos está desabilitado por enquanto.
              </div>
            ) : null}
            <form className="member-form" onSubmit={handleUpload}>
              <label className="field">
                <span>Arquivo</span>
                <input
                  type="file"
                  multiple
                  disabled={isStorageDisabled}
                  onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                />
              </label>
              <label className="field">
                <span>Descrição</span>
                <textarea
                  rows={4}
                  value={description}
                  disabled={isStorageDisabled}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                />
              </label>
              <button className="primary-button" disabled={isUploading || isStorageDisabled}>
                {isUploading ? "Enviando..." : "Enviar arquivo"}
              </button>
            </form>
          </article>

          <article className="panel files-list-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Biblioteca</p>
                <h2>{files.length ? `${files.length} arquivo(s)` : "Nenhum arquivo"}</h2>
              </div>
            </div>

            <div className="file-list">
              {files.length ? files.map((file) => (
                <div className="file-row" key={file.id}>
                  <div>
                    <strong>{file.originalName}</strong>
                    <span>{file.category} · {formatBytes(file.size)} · {formatDate(file.createdAt)}</span>
                    {file.description ? <p>{file.description}</p> : null}
                  </div>
                  <div className="file-row-actions">
                    <a className="soft-button" href={`/api/internal/files/${file.id}/download`}>
                      Baixar
                    </a>
                    <button className="text-button danger-text" type="button" onClick={() => handleDelete(file)}>
                      Excluir
                    </button>
                  </div>
                </div>
              )) : (
                <div className="empty-state">
                  {isStorageDisabled ? "Armazenamento desabilitado por enquanto." : "Nenhum arquivo enviado ainda."}
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
