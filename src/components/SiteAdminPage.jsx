"use client";

import { useEffect, useMemo, useState } from "react";

import LoadingBall from "./LoadingBall";
import UserPasswordDialog from "./UserPasswordDialog";

const CHAPTERS = [
  ["Ramo", "Ramo"],
  ["AESS", "AESS"],
  ["APS", "AP-S"],
  ["CAS", "CAS"],
  ["CS", "CS"],
  ["EdSoc", "EdSoc"],
  ["IAS", "IAS"],
  ["MTTS", "MTT-S"],
  ["PES", "PES"],
  ["RAS", "RAS"],
  ["SIGHT", "SIGHT"],
  ["VTS", "VTS"],
  ["WIE", "WIE"],
];

const MEMBER_ROLES = [
  "Membro",
  "Presidente",
  "Vice-Presidente",
  "Tesoureiro",
  "Webmaster",
  "Secretario",
  "Conselheiro",
];

function emptyMemberForm() {
  return {
    bio: "",
    bioEn: "",
    chapters: [],
    id: null,
    isPublic: true,
    name: "",
    photoPositionX: 50,
    photoPositionY: 50,
    photoUrl: "",
    photoZoom: 100,
    position: 0,
    role: "Membro",
  };
}

function emptyProjectForm() {
  return {
    chapter: "Ramo",
    description: "",
    driveFolderUrl: "",
    galleryImagesText: "",
    id: null,
    imageUrl: "",
    isPublic: true,
    linkUrl: "",
    photoPositionX: 50,
    photoPositionY: 50,
    photoZoom: 100,
    position: 0,
    showOnChapter: true,
    showOnHome: true,
    subtitle: "",
    title: "",
  };
}

function emptyPhotoForm() {
  return {
    id: null,
    imageUrl: "",
    isPublic: true,
    photoPositionX: 50,
    photoPositionY: 50,
    photoZoom: 100,
    position: 0,
    title: "",
  };
}

function projectToForm(project = {}) {
  return {
    ...emptyProjectForm(),
    ...project,
    galleryImagesText: Array.isArray(project.galleryImages) ? project.galleryImages.join("\n") : "",
  };
}

function photoFrameStyle(item = {}) {
  const positionX = item.photoPositionX ?? 50;
  const positionY = item.photoPositionY ?? 50;

  return {
    objectPosition: `${positionX}% ${positionY}%`,
    transform: `scale(${(item.photoZoom ?? 100) / 100})`,
    transformOrigin: `${positionX}% ${positionY}%`,
  };
}

function clampCropValue(value, min, max, fallback) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numberValue)));
}

function CropControls({ disabled, item, onChange, onNudge, onPreset }) {
  return (
    <div className="site-admin-crop-controls">
      <label className="field">
        <span><span>Horizontal</span><strong>{item.photoPositionX ?? 50}%</strong></span>
        <input type="range" min="0" max="100" step="1" value={item.photoPositionX ?? 50} onChange={(event) => onChange("photoPositionX", Number(event.target.value))} />
      </label>
      <label className="field">
        <span><span>Vertical</span><strong>{item.photoPositionY ?? 50}%</strong></span>
        <input type="range" min="0" max="100" step="1" value={item.photoPositionY ?? 50} onChange={(event) => onChange("photoPositionY", Number(event.target.value))} />
      </label>
      <label className="field">
        <span><span>Zoom</span><strong>{item.photoZoom ?? 100}%</strong></span>
        <input type="range" min="100" max="260" step="1" value={item.photoZoom ?? 100} onChange={(event) => onChange("photoZoom", Number(event.target.value))} />
      </label>
      <div className="site-admin-crop-nudges" aria-label="Ajustes finos do enquadramento">
        <button type="button" onClick={() => onNudge({ photoPositionY: -5 })} disabled={disabled}>↑</button>
        <button type="button" onClick={() => onNudge({ photoPositionX: -5 })} disabled={disabled}>←</button>
        <button type="button" onClick={() => onNudge({ photoPositionX: 5 })} disabled={disabled}>→</button>
        <button type="button" onClick={() => onNudge({ photoPositionY: 5 })} disabled={disabled}>↓</button>
        <button type="button" onClick={() => onNudge({ photoZoom: -10 })} disabled={disabled}>- zoom</button>
        <button type="button" onClick={() => onNudge({ photoZoom: 10 })} disabled={disabled}>+ zoom</button>
      </div>
      <div className="site-admin-crop-presets">
        <button type="button" onClick={() => onPreset()} disabled={disabled}>Centro</button>
        <button type="button" onClick={() => onPreset({ photoPositionY: 0, photoZoom: 120 })} disabled={disabled}>Topo</button>
        <button type="button" onClick={() => onPreset({ photoPositionY: 100, photoZoom: 120 })} disabled={disabled}>Base</button>
      </div>
    </div>
  );
}

function isInlineImageUrl(value) {
  return /^data:image\//i.test(String(value || ""));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

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
      <span className="theme-toggle__label">{theme === "dark" ? "Tema escuro" : "Tema claro"}</span>
    </button>
  );
}

export default function SiteAdminPage({ user }) {
  const [theme, setTheme] = useState("light");
  const [activeTab, setActiveTab] = useState("projects");
  const [members, setMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [projectForm, setProjectForm] = useState(emptyProjectForm);
  const [photoForm, setPhotoForm] = useState(emptyPhotoForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [status, setStatus] = useState({ tone: "idle", text: "Carregando administracao do site." });

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
    loadAll();
  }, []);

  const nextMemberPosition = useMemo(
    () => members.reduce((maxPosition, member) => Math.max(maxPosition, Number(member.position) || 0), -1) + 1,
    [members],
  );
  const nextProjectPosition = useMemo(
    () => projects.reduce((maxPosition, project) => Math.max(maxPosition, Number(project.position) || 0), -1) + 1,
    [projects],
  );
  const nextPhotoPosition = useMemo(
    () => photos.reduce((maxPosition, photo) => Math.max(maxPosition, Number(photo.position) || 0), -1) + 1,
    [photos],
  );

  async function loadAll() {
    setIsLoading(true);
    setStatus({ tone: "loading", text: "Atualizando administracao do site." });

    try {
      const [membersResponse, projectsResponse, photosResponse] = await Promise.all([
        fetch("/api/site-members/manage", { cache: "no-store" }),
        fetch("/api/site-projects/manage", { cache: "no-store" }),
        fetch("/api/site-home-photos/manage", { cache: "no-store" }),
      ]);

      if (!membersResponse.ok) {
        throw new Error(await readApiError(membersResponse, "Nao foi possivel carregar membros do site."));
      }
      if (!projectsResponse.ok) {
        throw new Error(await readApiError(projectsResponse, "Nao foi possivel carregar projetos do site."));
      }
      if (!photosResponse.ok) {
        throw new Error(await readApiError(photosResponse, "Nao foi possivel carregar fotos da homepage."));
      }

      const [membersPayload, projectsPayload, photosPayload] = await Promise.all([
        membersResponse.json(),
        projectsResponse.json(),
        photosResponse.json(),
      ]);

      setMembers(Array.isArray(membersPayload.members) ? membersPayload.members : []);
      setProjects(Array.isArray(projectsPayload.projects) ? projectsPayload.projects : []);
      setPhotos(Array.isArray(photosPayload.photos) ? photosPayload.photos : []);
      setStatus({ tone: "success", text: "Administracao do site atualizada." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Nao foi possivel carregar a administracao do site." });
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

  function updateMember(field, value) {
    setMemberForm((current) => ({ ...current, [field]: value }));
  }

  function updateProject(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhoto(field, value) {
    setPhotoForm((current) => ({ ...current, [field]: value }));
  }

  function nudgeCrop(setter, changes) {
    setter((current) => ({
      ...current,
      photoPositionX: clampCropValue((current.photoPositionX ?? 50) + (changes.photoPositionX || 0), 0, 100, 50),
      photoPositionY: clampCropValue((current.photoPositionY ?? 50) + (changes.photoPositionY || 0), 0, 100, 50),
      photoZoom: clampCropValue((current.photoZoom ?? 100) + (changes.photoZoom || 0), 100, 260, 100),
    }));
  }

  function presetCrop(setter, preset = {}) {
    setter((current) => ({
      ...current,
      photoPositionX: clampCropValue(preset.photoPositionX ?? 50, 0, 100, 50),
      photoPositionY: clampCropValue(preset.photoPositionY ?? 50, 0, 100, 50),
      photoZoom: clampCropValue(preset.photoZoom ?? 100, 100, 260, 100),
    }));
  }

  function toggleMemberChapter(chapterKey) {
    setMemberForm((current) => {
      const chapters = new Set(current.chapters);
      if (chapters.has(chapterKey)) {
        chapters.delete(chapterKey);
      } else {
        chapters.add(chapterKey);
      }

      return { ...current, chapters: [...chapters] };
    });
  }

  async function handlePhotoFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!/^image\/(?:jpeg|jpg|png|webp)$/i.test(file.type)) {
      setStatus({ tone: "error", text: "Use uma imagem JPG, PNG ou WebP." });
      return;
    }

    if (file.size > 1_100_000) {
      setStatus({ tone: "error", text: "Use uma imagem menor que 1 MB." });
      return;
    }

    try {
      const imageUrl = await fileToDataUrl(file);
      setPhotoForm((current) => ({
        ...current,
        imageUrl,
        title: current.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      setStatus({ tone: "idle", text: "Imagem carregada para pre-visualizacao." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Nao foi possivel ler a imagem." });
    }
  }

  async function submitJson(url, payload, method) {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Nao foi possivel concluir a acao."));
    }

    return response.json();
  }

  async function saveMember(event) {
    event.preventDefault();
    const isEditing = Boolean(memberForm.id);
    setIsSaving(true);
    setStatus({ tone: "loading", text: isEditing ? "Atualizando membro do site." : "Criando membro do site." });

    try {
      const payload = {
        ...memberForm,
        position: isEditing ? memberForm.position : nextMemberPosition,
      };
      await submitJson(
        isEditing ? `/api/site-members/manage/${memberForm.id}` : "/api/site-members/manage",
        payload,
        isEditing ? "PATCH" : "POST",
      );
      setMemberForm(emptyMemberForm());
      await loadAll();
      setStatus({ tone: "success", text: isEditing ? "Membro do site atualizado." : "Membro do site criado." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Nao foi possivel salvar o membro." });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProject(event) {
    event.preventDefault();
    const isEditing = Boolean(projectForm.id);
    setIsSaving(true);
    setStatus({ tone: "loading", text: isEditing ? "Atualizando projeto do site." : "Criando projeto do site." });

    try {
      const payload = {
        ...projectForm,
        galleryImages: projectForm.galleryImagesText,
        position: isEditing ? projectForm.position : nextProjectPosition,
      };
      delete payload.galleryImagesText;
      await submitJson(
        isEditing ? `/api/site-projects/manage/${projectForm.id}` : "/api/site-projects/manage",
        payload,
        isEditing ? "PATCH" : "POST",
      );
      setProjectForm(emptyProjectForm());
      await loadAll();
      setStatus({ tone: "success", text: isEditing ? "Projeto do site atualizado." : "Projeto do site criado." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Nao foi possivel salvar o projeto." });
    } finally {
      setIsSaving(false);
    }
  }

  async function savePhoto(event) {
    event.preventDefault();
    const isEditing = Boolean(photoForm.id);
    setIsSaving(true);
    setStatus({ tone: "loading", text: isEditing ? "Atualizando foto da homepage." : "Criando foto da homepage." });

    try {
      const payload = {
        ...photoForm,
        position: isEditing ? photoForm.position : nextPhotoPosition,
      };
      await submitJson(
        isEditing ? `/api/site-home-photos/manage/${photoForm.id}` : "/api/site-home-photos/manage",
        payload,
        isEditing ? "PATCH" : "POST",
      );
      setPhotoForm(emptyPhotoForm());
      await loadAll();
      setStatus({ tone: "success", text: isEditing ? "Foto atualizada." : "Foto adicionada a homepage." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Nao foi possivel salvar a foto." });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeItem(kind, id) {
    if (!window.confirm("Remover este item do site?")) {
      return;
    }

    const pathByKind = {
      member: "site-members",
      photo: "site-home-photos",
      project: "site-projects",
    };

    setIsSaving(true);
    setStatus({ tone: "loading", text: "Removendo item do site." });

    try {
      const response = await fetch(`/api/${pathByKind[kind]}/manage/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Nao foi possivel remover o item."));
      }
      await loadAll();
      setStatus({ tone: "success", text: "Item removido do site." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Nao foi possivel remover o item." });
    } finally {
      setIsSaving(false);
    }
  }

  function editMember(member) {
    setActiveTab("members");
    setMemberForm({ ...emptyMemberForm(), ...member });
    setStatus({ tone: "idle", text: `Editando ${member.name}.` });
  }

  function editProject(project) {
    setActiveTab("projects");
    setProjectForm(projectToForm(project));
    setStatus({ tone: "idle", text: `Editando ${project.title}.` });
  }

  function editPhoto(photo) {
    setActiveTab("photos");
    setPhotoForm({ ...emptyPhotoForm(), ...photo });
    setStatus({ tone: "idle", text: `Editando ${photo.title || "foto da homepage"}.` });
  }

  if (isLoading) {
    return <LoadingBall />;
  }

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/diretoria" className="site-brand" aria-label="Ir para diretoria">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Administracao do site</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Inicio</a></li>
          <li><a href="/diretoria" aria-current="page">Diretoria</a></li>
        </ul>

        <div className="topbar-actions">
          <button
            className="user-chip"
            type="button"
            onClick={() => setIsPasswordDialogOpen(true)}
            title="Alterar senha"
          >
            {user.name}
          </button>
          <button className="ghost-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <ThemeToggle theme={theme} onToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))} />
      {isPasswordDialogOpen ? (
        <UserPasswordDialog user={user} onClose={() => setIsPasswordDialogOpen(false)} />
      ) : null}

      <main className="page-main site-admin-page">
        <section className="hero-panel internal-hero site-admin-hero">
          <div>
            <p className="panel-kicker">Site do Ramo</p>
            <h1>Administracao do site</h1>
            <p>Gerencie os membros, projetos e fotos publicados no site do Ramo pelo painel interno.</p>
          </div>
          <div className={`status-box tone-${status.tone}`}>
            <span>Status</span>
            <strong>{status.text}</strong>
          </div>
        </section>

        <div className="site-admin-tabs" role="tablist" aria-label="Areas de administracao do site">
          {[
            ["projects", "Projetos"],
            ["members", "Membros"],
            ["photos", "Fotos da homepage"],
          ].map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? "is-active" : ""}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "projects" ? (
          <section className="site-admin-layout">
            <article className="panel">
              <div className="section-heading">
                <p className="panel-kicker">{projectForm.id ? "Editar projeto" : "Novo projeto"}</p>
                <h2>{projectForm.id ? projectForm.title : "Projeto do site"}</h2>
              </div>

              <form className="internal-form" onSubmit={saveProject}>
                <div className="internal-form-grid">
                  <label className="field">
                    <span>Titulo</span>
                    <input value={projectForm.title} onChange={(event) => updateProject("title", event.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Capitulo</span>
                    <select value={projectForm.chapter} onChange={(event) => updateProject("chapter", event.target.value)}>
                      {CHAPTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>
                  </label>
                  <label className="field field-span-2">
                    <span>Subtitulo</span>
                    <input value={projectForm.subtitle} onChange={(event) => updateProject("subtitle", event.target.value)} />
                  </label>
                  <label className="field field-span-2">
                    <span>Descricao do popup</span>
                    <textarea value={projectForm.description} onChange={(event) => updateProject("description", event.target.value)} />
                  </label>
                  <label className="field field-span-2">
                    <span>Imagem principal</span>
                    <input value={projectForm.imageUrl} onChange={(event) => updateProject("imageUrl", event.target.value)} placeholder="Link publico ou Google Drive" />
                  </label>
                  <label className="field field-span-2">
                    <span>Pasta do Google Drive para slideshow</span>
                    <input value={projectForm.driveFolderUrl} onChange={(event) => updateProject("driveFolderUrl", event.target.value)} placeholder="https://drive.google.com/drive/folders/..." />
                  </label>
                  <label className="field field-span-2">
                    <span>Fotos do slideshow</span>
                    <textarea value={projectForm.galleryImagesText} onChange={(event) => updateProject("galleryImagesText", event.target.value)} placeholder="Um link por linha" />
                  </label>
                  <label className="field field-span-2">
                    <span>Link ao clicar</span>
                    <input value={projectForm.linkUrl} onChange={(event) => updateProject("linkUrl", event.target.value)} placeholder="Opcional" />
                  </label>
                </div>

                <div className="site-admin-checks">
                  <label className="field inline-check">
                    <input type="checkbox" checked={projectForm.isPublic} onChange={(event) => updateProject("isPublic", event.target.checked)} />
                    <span>Publicado</span>
                  </label>
                  <label className="field inline-check">
                    <input type="checkbox" checked={projectForm.showOnHome} onChange={(event) => updateProject("showOnHome", event.target.checked)} />
                    <span>Mostrar na homepage</span>
                  </label>
                  <label className="field inline-check">
                    <input type="checkbox" checked={projectForm.showOnChapter} onChange={(event) => updateProject("showOnChapter", event.target.checked)} />
                    <span>Mostrar no capitulo</span>
                  </label>
                </div>

                {projectForm.imageUrl ? (
                  <div className="site-admin-crop-preview">
                    <img src={projectForm.imageUrl} alt="" style={photoFrameStyle(projectForm)} />
                  </div>
                ) : null}

                <CropControls
                  disabled={isSaving}
                  item={projectForm}
                  onChange={updateProject}
                  onNudge={(changes) => nudgeCrop(setProjectForm, changes)}
                  onPreset={(preset) => presetCrop(setProjectForm, preset)}
                />

                <div className="site-admin-form-actions">
                  <button className="primary-button" disabled={isSaving}>{projectForm.id ? "Salvar projeto" : "Criar projeto"}</button>
                  {projectForm.id ? <button className="soft-button" type="button" onClick={() => setProjectForm(emptyProjectForm())}>Cancelar edicao</button> : null}
                </div>
              </form>
            </article>

            <AdminList
              emptyText="Nenhum projeto cadastrado."
              items={projects}
              renderItem={(project) => (
                <article className="site-admin-row" key={project.id}>
                  <div className="site-admin-row-thumb">{project.imageUrl ? <img src={project.imageUrl} alt="" style={photoFrameStyle(project)} /> : null}</div>
                  <div>
                    <span>{project.chapter}</span>
                    <strong>{project.title}</strong>
                    <p>{project.subtitle || "Sem subtitulo"}</p>
                  </div>
                  <div className="site-admin-row-actions">
                    <button className="text-button" type="button" onClick={() => editProject(project)}>Editar</button>
                    <button className="text-button danger" type="button" onClick={() => removeItem("project", project.id)}>Remover</button>
                  </div>
                </article>
              )}
              title="Projetos publicados"
            />
          </section>
        ) : null}

        {activeTab === "members" ? (
          <section className="site-admin-layout">
            <article className="panel">
              <div className="section-heading">
                <p className="panel-kicker">{memberForm.id ? "Editar membro" : "Novo membro"}</p>
                <h2>{memberForm.id ? memberForm.name : "Membro do site"}</h2>
              </div>

              <form className="internal-form" onSubmit={saveMember}>
                <div className="internal-form-grid">
                  <label className="field">
                    <span>Nome</span>
                    <input value={memberForm.name} onChange={(event) => updateMember("name", event.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Cargo</span>
                    <select value={memberForm.role} onChange={(event) => updateMember("role", event.target.value)}>
                      {MEMBER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </label>
                  <label className="field field-span-2">
                    <span>Foto</span>
                    <input value={memberForm.photoUrl} onChange={(event) => updateMember("photoUrl", event.target.value)} placeholder="Link publico ou Google Drive" />
                  </label>
                  <label className="field field-span-2">
                    <span>Biografia</span>
                    <textarea value={memberForm.bio} onChange={(event) => updateMember("bio", event.target.value)} />
                  </label>
                  <label className="field field-span-2">
                    <span>Biografia em inglês</span>
                    <textarea value={memberForm.bioEn} onChange={(event) => updateMember("bioEn", event.target.value)} />
                  </label>
                </div>

                <div className="site-admin-chapter-grid">
                  {CHAPTERS.filter(([key]) => key !== "Ramo").map(([key, label]) => (
                    <label className="field inline-check" key={key}>
                      <input type="checkbox" checked={memberForm.chapters.includes(key)} onChange={() => toggleMemberChapter(key)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <label className="field inline-check">
                  <input type="checkbox" checked={memberForm.isPublic} onChange={(event) => updateMember("isPublic", event.target.checked)} />
                  <span>Publicado</span>
                </label>

                {memberForm.photoUrl ? (
                  <div className="site-admin-crop-preview site-admin-crop-preview--square">
                    <img src={memberForm.photoUrl} alt="" style={photoFrameStyle(memberForm)} />
                  </div>
                ) : null}

                <CropControls
                  disabled={isSaving}
                  item={memberForm}
                  onChange={updateMember}
                  onNudge={(changes) => nudgeCrop(setMemberForm, changes)}
                  onPreset={(preset) => presetCrop(setMemberForm, preset)}
                />

                <div className="site-admin-form-actions">
                  <button className="primary-button" disabled={isSaving}>{memberForm.id ? "Salvar membro" : "Criar membro"}</button>
                  {memberForm.id ? <button className="soft-button" type="button" onClick={() => setMemberForm(emptyMemberForm())}>Cancelar edicao</button> : null}
                </div>
              </form>
            </article>

            <AdminList
              emptyText="Nenhum membro cadastrado."
              items={members}
              renderItem={(member) => (
                <article className="site-admin-row" key={member.id}>
                  <div className="site-admin-row-thumb site-admin-row-thumb--square">{member.photoUrl ? <img src={member.photoUrl} alt="" style={photoFrameStyle(member)} /> : null}</div>
                  <div>
                    <span>{member.role}</span>
                    <strong>{member.name}</strong>
                    <p>{member.chapters?.join(", ") || "Sem capitulo"}</p>
                  </div>
                  <div className="site-admin-row-actions">
                    <button className="text-button" type="button" onClick={() => editMember(member)}>Editar</button>
                    <button className="text-button danger" type="button" onClick={() => removeItem("member", member.id)}>Remover</button>
                  </div>
                </article>
              )}
              title="Membros publicados"
            />
          </section>
        ) : null}

        {activeTab === "photos" ? (
          <section className="site-admin-layout">
            <article className="panel">
              <div className="section-heading">
                <p className="panel-kicker">{photoForm.id ? "Editar foto" : "Nova foto"}</p>
                <h2>{photoForm.id ? photoForm.title || "Foto da homepage" : "Foto da homepage"}</h2>
              </div>

              <form className="internal-form" onSubmit={savePhoto}>
                <label className="field">
                  <span>Titulo</span>
                  <input value={photoForm.title} onChange={(event) => updatePhoto("title", event.target.value)} />
                </label>
                <label className="field">
                  <span>Arquivo da imagem</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoFileChange} />
                </label>
                <label className="field">
                  <span>Link da imagem ou Google Drive</span>
                  <input value={isInlineImageUrl(photoForm.imageUrl) ? "" : photoForm.imageUrl} onChange={(event) => updatePhoto("imageUrl", event.target.value)} placeholder="https://drive.google.com/file/d/..." />
                </label>
                <label className="field inline-check">
                  <input type="checkbox" checked={photoForm.isPublic} onChange={(event) => updatePhoto("isPublic", event.target.checked)} />
                  <span>Publicado</span>
                </label>

                {photoForm.imageUrl ? (
                  <div className="site-admin-crop-preview">
                    <img src={photoForm.imageUrl} alt="" style={photoFrameStyle(photoForm)} />
                  </div>
                ) : null}

                <CropControls
                  disabled={isSaving}
                  item={photoForm}
                  onChange={updatePhoto}
                  onNudge={(changes) => nudgeCrop(setPhotoForm, changes)}
                  onPreset={(preset) => presetCrop(setPhotoForm, preset)}
                />

                <div className="site-admin-form-actions">
                  <button className="primary-button" disabled={isSaving || !photoForm.imageUrl}>{photoForm.id ? "Salvar foto" : "Adicionar foto"}</button>
                  {photoForm.id ? <button className="soft-button" type="button" onClick={() => setPhotoForm(emptyPhotoForm())}>Cancelar edicao</button> : null}
                </div>
              </form>
            </article>

            <AdminList
              emptyText="Nenhuma foto cadastrada."
              items={photos}
              renderItem={(photo) => (
                <article className="site-admin-row" key={photo.id}>
                  <div className="site-admin-row-thumb">{photo.imageUrl ? <img src={photo.imageUrl} alt="" style={photoFrameStyle(photo)} /> : null}</div>
                  <div>
                    <span>Homepage</span>
                    <strong>{photo.title || "Foto do Ramo"}</strong>
                    <p>{photo.isPublic ? "Publicada" : "Oculta"}</p>
                  </div>
                  <div className="site-admin-row-actions">
                    <button className="text-button" type="button" onClick={() => editPhoto(photo)}>Editar</button>
                    <button className="text-button danger" type="button" onClick={() => removeItem("photo", photo.id)}>Remover</button>
                  </div>
                </article>
              )}
              title="Fotos publicadas"
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}

function AdminList({ emptyText, items, renderItem, title }) {
  return (
    <article className="panel site-admin-list-panel">
      <div className="section-heading">
        <p className="panel-kicker">Biblioteca</p>
        <h2>{title}</h2>
      </div>

      <div className="site-admin-list">
        {items.length ? items.map(renderItem) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </article>
  );
}
