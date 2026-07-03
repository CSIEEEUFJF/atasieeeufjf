"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ieeeSocietyMemberships,
  membershipMembers,
} from "../data/membership-members";

function emptyMemberForm() {
  return {
    city: "Juiz de Fora",
    email: "",
    grade: "Student Member",
    ieeeStatus: "Active",
    memberNumber: "",
    name: "",
    renewYear: String(new Date().getFullYear()),
    section: "Minas Gerais Section",
    societies: [],
    state: "Minas Gerais",
  };
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function societyLabel(code) {
  const society = ieeeSocietyMemberships[code];
  return society ? `${society.chapter} - ${society.name}` : code;
}

function memberSocietyLabels(member) {
  return member.societies.map(societyLabel);
}

function mergeMembershipMembers(sheetMembers, databaseMembers) {
  const overridesByNumber = new Map(databaseMembers.map((member) => [member.memberNumber, member]));
  const sheetNumbers = new Set(sheetMembers.map((member) => member.memberNumber));
  const mergedSheetMembers = sheetMembers
    .map((member) => {
      const override = overridesByNumber.get(member.memberNumber);
      if (override?.isDeleted) {
        return null;
      }

      return override ? { ...member, ...override } : member;
    })
    .filter(Boolean);
  const manualMembers = databaseMembers.filter(
    (member) => !member.isDeleted && !sheetNumbers.has(member.memberNumber),
  );

  return [...mergedSheetMembers, ...manualMembers];
}

export default function MembershipControlPage({ user }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [society, setSociety] = useState("all");
  const [databaseMembers, setDatabaseMembers] = useState([]);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [modalMode, setModalMode] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ tone: "idle", text: "Membresias carregadas." });

  useEffect(() => {
    loadDatabaseMembers();
  }, []);

  async function loadDatabaseMembers() {
    try {
      const response = await fetch("/api/memberships", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Não foi possível carregar alterações salvas.");
      }

      const payload = await response.json();
      setDatabaseMembers(Array.isArray(payload.members) ? payload.members : []);
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível carregar alterações salvas." });
    }
  }

  const members = useMemo(
    () => mergeMembershipMembers(membershipMembers, databaseMembers),
    [databaseMembers],
  );

  const gradeOptions = useMemo(
    () => [...new Set(members.map((member) => member.grade).filter(Boolean))].sort(),
    [members],
  );
  const societyOptions = useMemo(
    () => Object.keys(ieeeSocietyMemberships)
      .sort((left, right) => societyLabel(left).localeCompare(societyLabel(right))),
    [],
  );
  const filteredMembers = useMemo(() => {
    const search = normalizeSearch(query);

    return members.filter((member) => {
      const haystack = normalizeSearch([
        member.memberNumber,
        member.name,
        member.email,
        member.city,
        member.section,
        member.societies.join(" "),
        memberSocietyLabels(member).join(" "),
      ].join(" "));
      const matchesSearch = !search || haystack.includes(search);
      const matchesGrade = grade === "all" || member.grade === grade;
      const matchesSociety = society === "all" || member.societies.includes(society);

      return matchesSearch && matchesGrade && matchesSociety;
    });
  }, [grade, members, query, society]);

  const stats = [
    ["Membros", members.length],
    ["Ativos", members.filter((member) => member.ieeeStatus === "Active").length],
    ["Sociedades", societyOptions.length],
    ["Salvos", databaseMembers.filter((member) => !member.isDeleted).length],
  ];

  function updateMemberForm(field, value) {
    setMemberForm((current) => ({ ...current, [field]: value }));
  }

  function toggleFormSociety(code) {
    setMemberForm((current) => {
      const societies = new Set(current.societies);
      if (societies.has(code)) {
        societies.delete(code);
      } else {
        societies.add(code);
      }

      return { ...current, societies: [...societies] };
    });
  }

  function openCreateModal() {
    setEditingMember(null);
    setMemberForm(emptyMemberForm());
    setModalMode("create");
  }

  function openEditModal(member) {
    setEditingMember(member);
    setMemberForm({
      ...emptyMemberForm(),
      ...member,
      societies: Array.isArray(member.societies) ? member.societies : [],
    });
    setModalMode("edit");
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setModalMode(null);
    setEditingMember(null);
    setMemberForm(emptyMemberForm());
  }

  async function saveMember(event) {
    event.preventDefault();
    const cleanMember = {
      ...memberForm,
      email: memberForm.email.trim(),
      memberNumber: memberForm.memberNumber.trim() || `manual-${Date.now()}`,
      name: memberForm.name.trim(),
      societies: [...new Set(memberForm.societies)].sort(),
      source: modalMode === "edit" && !editingMember?.id ? "override" : "manual",
    };

    if (!cleanMember.name || !cleanMember.email) {
      return;
    }

    setIsSaving(true);
    setStatus({ tone: "loading", text: modalMode === "edit" ? "Atualizando membresias." : "Salvando novo membro." });

    try {
      const response = await fetch("/api/memberships", {
        body: JSON.stringify(cleanMember),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Não foi possível salvar.");
      }

      await loadDatabaseMembers();
      setModalMode(null);
      setEditingMember(null);
      setMemberForm(emptyMemberForm());
      setStatus({ tone: "success", text: modalMode === "edit" ? "Membresias atualizadas." : "Membro adicionado." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível salvar." });
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteMember(member) {
    if (!window.confirm(`Excluir ${member.name}?`)) {
      return;
    }

    const identifier = member.id
      ? `db-${member.id}`
      : `member-${encodeURIComponent(member.memberNumber)}`;
    setIsSaving(true);
    setStatus({ tone: "loading", text: "Excluindo membro." });

    try {
      const response = await fetch(`/api/memberships/${identifier}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Não foi possível excluir.");
      }

      await loadDatabaseMembers();
      setStatus({ tone: "success", text: "Membro excluído." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível excluir." });
    } finally {
      setIsSaving(false);
    }
  }

  const modalTitle = modalMode === "edit"
    ? `Editar membresias de ${editingMember?.name || "membro"}`
    : "Adicionar membro";

  return (
    <div className="app-shell">
      <header className="site-nav">
        <a href="/diretoria" className="site-brand" aria-label="Ir para diretoria">
          <span className="site-brand-badge" aria-hidden="true" />
          <span className="site-brand-lockup">
            <span className="site-brand-text">Sistema Interno - IEEE UFJF</span>
            <span className="site-brand-meta">Controle de membresias</span>
          </span>
        </a>

        <ul className="nav-links">
          <li><a href="/">Inicio</a></li>
          <li><a href="/diretoria" aria-current="page">Diretoria</a></li>
        </ul>

        <div className="topbar-actions">
          <span className="user-chip">{user.name}</span>
        </div>
      </header>

      <main className="page-main membership-page">
        <section className="hero-panel internal-hero membership-hero">
          <div>
            <p className="panel-kicker">IEEE Membership</p>
            <h1>Controle de membresias</h1>
          </div>
          <div className={`status-box tone-${status.tone}`}>
            <span>Status</span>
            <strong>{status.text}</strong>
          </div>
          <div className="membership-stat-grid">
            {stats.map(([label, value]) => (
              <div className="membership-stat" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel membership-controls">
          <label className="field">
            <span>Busca</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, e-mail, número IEEE, cidade ou sociedade"
            />
          </label>
          <label className="field">
            <span>Grau</span>
            <select value={grade} onChange={(event) => setGrade(event.target.value)}>
              <option value="all">Todos</option>
              {gradeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Sociedade</span>
            <select value={society} onChange={(event) => setSociety(event.target.value)}>
              <option value="all">Todas</option>
              {societyOptions.map((option) => <option key={option} value={option}>{societyLabel(option)}</option>)}
            </select>
          </label>
          <div className="membership-create-action">
            <button className="primary-button" type="button" onClick={openCreateModal}>Novo membro</button>
          </div>
        </section>

        <section className="panel membership-table-panel">
          <div className="section-heading">
            <p className="panel-kicker">Lista filtrada</p>
            <h2>{filteredMembers.length} membros</h2>
          </div>

          <div className="membership-table-wrap">
            <table className="membership-table">
              <thead>
                <tr>
                  <th>Número IEEE</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Grau</th>
                  <th>Status</th>
                  <th>Renovação</th>
                  <th>Local</th>
                  <th>Sociedades</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id ? `manual-${member.id}` : member.memberNumber}>
                    <td>{member.memberNumber.startsWith("manual-") ? "Manual" : member.memberNumber}</td>
                    <td><strong>{member.name}</strong></td>
                    <td><a href={`mailto:${member.email}`}>{member.email}</a></td>
                    <td>{member.grade}</td>
                    <td>{member.ieeeStatus}</td>
                    <td>{member.renewYear}</td>
                    <td>{[member.city, member.state || member.section].filter(Boolean).join(" / ")}</td>
                    <td>
                      {member.societies.length ? (
                        <div className="membership-society-chips">
                          {member.societies.map((code) => <span key={code}>{societyLabel(code)}</span>)}
                        </div>
                      ) : "Sem sociedade"}
                    </td>
                    <td>
                      <div className="membership-row-actions">
                        <button className="text-button" disabled={isSaving} type="button" onClick={() => openEditModal(member)}>
                          Editar membresias
                        </button>
                        <button className="text-button danger" disabled={isSaving} type="button" onClick={() => deleteMember(member)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {modalMode ? (
        <div className="modal-backdrop" role="presentation">
          <div className="membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-modal-title">
            <div className="section-heading">
              <p className="panel-kicker">{modalMode === "edit" ? "Membresias IEEE" : "Cadastro manual"}</p>
              <h2 id="membership-modal-title">{modalTitle}</h2>
            </div>

            <form className="membership-add-form" onSubmit={saveMember}>
              <label className="field">
                <span>Número IEEE</span>
                <input
                  disabled={modalMode === "edit"}
                  value={memberForm.memberNumber}
                  onChange={(event) => updateMemberForm("memberNumber", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Nome</span>
                <input
                  disabled={modalMode === "edit"}
                  required
                  value={memberForm.name}
                  onChange={(event) => updateMemberForm("name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>E-mail</span>
                <input
                  disabled={modalMode === "edit"}
                  required
                  type="email"
                  value={memberForm.email}
                  onChange={(event) => updateMemberForm("email", event.target.value)}
                />
              </label>
              {modalMode === "create" ? (
                <>
                  <label className="field">
                    <span>Renovação</span>
                    <input value={memberForm.renewYear} onChange={(event) => updateMemberForm("renewYear", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Cidade</span>
                    <input value={memberForm.city} onChange={(event) => updateMemberForm("city", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Estado</span>
                    <input value={memberForm.state} onChange={(event) => updateMemberForm("state", event.target.value)} />
                  </label>
                </>
              ) : null}

              <fieldset className="membership-society-picker">
                <legend>Sociedades IEEE</legend>
                {societyOptions.map((option) => (
                  <label key={option}>
                    <input
                      type="checkbox"
                      checked={memberForm.societies.includes(option)}
                      onChange={() => toggleFormSociety(option)}
                    />
                    <span>{societyLabel(option)}</span>
                  </label>
                ))}
              </fieldset>

              <div className="membership-add-actions">
                <button className="soft-button" disabled={isSaving} type="button" onClick={closeModal}>Cancelar</button>
                <button className="primary-button" disabled={isSaving}>
                  {modalMode === "edit" ? "Salvar membresias" : "Adicionar membro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
