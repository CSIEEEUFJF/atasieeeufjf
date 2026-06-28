"use client";

import { useEffect, useState } from "react";

import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";
import { DEMO_USER } from "./demo-data";

const DEFAULT_HOME_PHOTOS = [
  {
    id: "default-login",
    imageUrl: "/login-ramo.jpg",
    photoPositionX: 50,
    photoPositionY: 50,
    photoZoom: 100,
    title: "Ramo IEEE UFJF",
  },
  {
    id: "default-home-2",
    imageUrl: "/home-ramo-2.jpg",
    photoPositionX: 50,
    photoPositionY: 50,
    photoZoom: 100,
    title: "Atividade do Ramo",
  },
];

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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function createPhotoForm(photo = {}) {
  return {
    id: photo.id || null,
    imageUrl: photo.imageUrl || "",
    photoPositionX: photo.photoPositionX ?? 50,
    photoPositionY: photo.photoPositionY ?? 50,
    photoZoom: photo.photoZoom ?? 100,
    title: photo.title || "",
  };
}

function photoFrameStyle(photo = {}) {
  const positionX = photo.photoPositionX ?? 50;
  const positionY = photo.photoPositionY ?? 50;

  return {
    objectPosition: `${positionX}% ${positionY}%`,
    transform: `scale(${(photo.photoZoom ?? 100) / 100})`,
    transformOrigin: `${positionX}% ${positionY}%`,
  };
}

function isManagedPhotoId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

function isInlineImageUrl(value) {
  return /^data:image\//i.test(String(value || ""));
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
  const [homePhotos, setHomePhotos] = useState(DEFAULT_HOME_PHOTOS);
  const [homePhotoIndex, setHomePhotoIndex] = useState(0);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [photoForm, setPhotoForm] = useState(createPhotoForm);
  const [photoMessage, setPhotoMessage] = useState("");
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isDemoContactOpen, setIsDemoContactOpen] = useState(false);

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

  useEffect(() => {
    if (!auth.user) {
      return;
    }

    let active = true;

    async function loadHomePhotos() {
      try {
        const response = await fetch("/api/site-home-photos", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const photos = Array.isArray(payload.photos) ?payload.photos : [];
        if (active && photos.length) {
          setHomePhotos(photos);
        }
      } catch {
        if (active) {
          setHomePhotos(DEFAULT_HOME_PHOTOS);
        }
      }
    }

    loadHomePhotos();
    return () => {
      active = false;
    };
  }, [auth.user]);

  useEffect(() => {
    if (homePhotos.length <= 1) {
      setHomePhotoIndex(0);
      return undefined;
    }

    const timer = window.setInterval(() => {
      setHomePhotoIndex((current) => (current + 1) % homePhotos.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [homePhotos.length]);

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

  async function handlePhotoFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!/^image\/(?:jpeg|jpg|png|webp)$/i.test(file.type)) {
      setPhotoMessage("Use uma imagem JPG, PNG ou WebP.");
      return;
    }

    if (file.size > 1_100_000) {
      setPhotoMessage("Use uma imagem menor que 1 MB.");
      return;
    }

    try {
      const imageUrl = await fileToDataUrl(file);
      setPhotoForm((current) => ({
        ...current,
        imageUrl,
        title: current.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      setPhotoMessage("");
    } catch (error) {
      setPhotoMessage(error.message || "Não foi possível ler a imagem.");
    }
  }

  async function handleCreatePhoto(event) {
    event.preventDefault();
    setIsSavingPhoto(true);
    setPhotoMessage(photoForm.id ?"Atualizando foto." : "Salvando foto.");

    try {
      const isEditing = isManagedPhotoId(photoForm.id);
      const response = await fetch(
        isEditing ?`/api/site-home-photos/manage/${photoForm.id}` : "/api/site-home-photos/manage",
        {
        body: JSON.stringify(photoForm),
        headers: { "Content-Type": "application/json" },
          method: isEditing ?"PATCH" : "POST",
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível salvar a foto."));
      }

      const payload = await response.json();
      setHomePhotos((current) => {
        if (!isEditing) {
          return [...current, payload.photo].filter(Boolean);
        }

        return current.map((photo) => (Number(photo.id) === Number(photoForm.id) ?payload.photo : photo));
      });
      setPhotoForm(createPhotoForm());
      setPhotoMessage(isEditing ?"Foto atualizada." : "Foto adicionada ao slideshow.");
    } catch (error) {
      setPhotoMessage(error.message || "Não foi possível salvar a foto.");
    } finally {
      setIsSavingPhoto(false);
    }
  }

  function editPhoto(photo) {
    setPhotoForm(createPhotoForm(photo));
    setPhotoMessage(isManagedPhotoId(photo.id)
      ?"Ajuste o enquadramento e salve."
      : "Fotos padrão podem ser ajustadas nesta sessão; para salvar, adicione uma nova foto.");
  }

  async function deletePhoto(photo) {
    if (!isManagedPhotoId(photo.id)) {
      setHomePhotos((current) => current.filter((item) => item.id !== photo.id));
      return;
    }

    if (!window.confirm("Remover esta foto do slideshow?")) {
      return;
    }

    try {
      const response = await fetch(`/api/site-home-photos/manage/${photo.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Não foi possível remover a foto."));
      }

      setHomePhotos((current) => current.filter((item) => item.id !== photo.id));
      setPhotoMessage("Foto removida.");
    } catch (error) {
      setPhotoMessage(error.message || "Não foi possível remover a foto.");
    }
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
      href: demoMode ?"/demo" : "/arquivos",
      kicker: "Arquivos",
      title: "Armazenamento",
      text: "Envie e baixe arquivos pessoais do sistema interno.",
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
  const isEditingManagedPhoto = isManagedPhotoId(photoForm.id);

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
      {demoMode && isDemoContactOpen ?(
        <div className="dialog-backdrop" role="presentation">
          <section
            className="password-dialog demo-contact-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-contact-dialog-title"
          >
            <div className="password-dialog-header">
              <div>
                <span>Contato</span>
                <h2 id="demo-contact-dialog-title">CS IEEE UFJF</h2>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => setIsDemoContactOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="demo-contact-list">
              <a href="mailto:ieee.csufjf@gmail.com">
                <span>E-mail</span>
                <strong>ieee.csufjf@gmail.com</strong>
              </a>
              <a href="https://www.instagram.com/ieeecs.ufjf" target="_blank" rel="noreferrer">
                <span>Instagram</span>
                <strong>@ieeecs.ufjf</strong>
              </a>
            </div>
          </section>
        </div>
      ) : null}
      {!demoMode && isPhotoDialogOpen ?(
        <div className="dialog-backdrop" role="presentation">
          <section
            className="password-dialog home-photo-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-photo-dialog-title"
          >
            <div className="password-dialog-header">
              <div>
                <span>Homepage</span>
                <h2 id="home-photo-dialog-title">Fotos do slideshow</h2>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => setIsPhotoDialogOpen(false)}
                disabled={isSavingPhoto}
              >
                Fechar
              </button>
            </div>

            <form className="internal-form" onSubmit={handleCreatePhoto}>
              <label className="field">
                <span>Título</span>
                <input
                  value={photoForm.title}
                  onChange={(event) =>
                    setPhotoForm((current) => ({ ...current, title: event.target.value }))
                  }
                  maxLength={120}
                />
              </label>

              <label className="field">
                <span>Arquivo da imagem</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoFileChange}
                />
              </label>

              <label className="field">
                <span>Link da imagem ou Google Drive</span>
                <input
                  value={isInlineImageUrl(photoForm.imageUrl) ?"" : photoForm.imageUrl}
                  onChange={(event) =>
                    setPhotoForm((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://drive.google.com/file/d/..."
                />
              </label>

              {photoForm.imageUrl ?(
                <>
                  <div className="home-photo-preview">
                    <img src={photoForm.imageUrl} alt="" style={photoFrameStyle(photoForm)} />
                  </div>

                  <div className="home-photo-controls">
                    <label className="field">
                      <span>Posição horizontal</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={photoForm.photoPositionX}
                        onChange={(event) =>
                          setPhotoForm((current) => ({
                            ...current,
                            photoPositionX: Number(event.target.value),
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Posição vertical</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={photoForm.photoPositionY}
                        onChange={(event) =>
                          setPhotoForm((current) => ({
                            ...current,
                            photoPositionY: Number(event.target.value),
                          }))
                        }
                      />
                    </label>

                    <label className="field">
                      <span>Zoom</span>
                      <input
                        type="range"
                        min="100"
                        max="220"
                        value={photoForm.photoZoom}
                        onChange={(event) =>
                          setPhotoForm((current) => ({
                            ...current,
                            photoZoom: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                </>
              ) : null}

              {photoMessage ?(
                <div className="status-box tone-idle">
                  <span>Status</span>
                  <strong>{photoMessage}</strong>
                </div>
              ) : null}

              <button className="primary-button" disabled={isSavingPhoto || !photoForm.imageUrl}>
                {isSavingPhoto
                  ?"Salvando..."
                  : isEditingManagedPhoto
                    ?"Salvar enquadramento"
                    : photoForm.id
                      ?"Salvar como nova foto"
                    : "Adicionar foto"}
              </button>
            </form>

            <div className="home-photo-manage-list">
              {homePhotos.map((photo) => (
                <article className="home-photo-manage-item" key={photo.id}>
                  <div className="home-photo-manage-thumb">
                    <img src={photo.imageUrl} alt="" style={photoFrameStyle(photo)} />
                  </div>
                  <span>{photo.title || "Foto do Ramo"}</span>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => editPhoto(photo)}
                  >
                    Editar
                  </button>
                  <button
                    className="text-button danger"
                    type="button"
                    onClick={() => deletePhoto(photo)}
                  >
                    Remover
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <main className="page-main board-page-main">
        <section className="home-slideshow" aria-label="Fotos do Ramo IEEE UFJF">
          <div className="home-slideshow__track">
            {homePhotos.map((photo, index) => (
              <img
                className={index === homePhotoIndex ?"is-active" : ""}
                src={photo.imageUrl}
                alt={photo.title || "Foto do Ramo IEEE UFJF"}
                key={photo.id}
                style={photoFrameStyle(photo)}
              />
            ))}
          </div>
          {!demoMode && auth.user.canManageMembers ?(
            <button
              className="home-photo-button"
              type="button"
              onClick={() => setIsPhotoDialogOpen(true)}
            >
              Adicionar foto
            </button>
          ) : null}
        </section>

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

        {demoMode ?(
          <section className="demo-contact-cta">
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsDemoContactOpen(true)}
            >
              Gostou do sistema e quer implementar no seu Ramo? Entre em contato conosco!
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
