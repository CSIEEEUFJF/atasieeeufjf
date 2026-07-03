"use client";

import { useEffect, useMemo, useState } from "react";

import {
  ieeeSocietyMemberships,
  membershipMembers,
  membershipSource,
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

export default function MembershipControlPage({ user }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [society, setSociety] = useState("all");
  const [addedMembers, setAddedMembers] = useState([]);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState({ tone: "idle", text: "Membresias carregadas." });

  useEffect(() => {
    let active = true;

    async function loadAddedMembers() {
      try {
        const response = await fetch("/api/memberships", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Não foi possível carregar membresias adicionais.");
        }

        const payload = await response.json();
        if (active) {
          setAddedMembers(Array.isArray(payload.members) ? payload.members : []);
        }
      } catch (error) {
        if (active) {
          setStatus({ tone: "error", text: error.message || "Não foi possível carregar membresias adicionais." });
        }
      }
    }

    loadAddedMembers();
    return () => {
      active = false;
    };
  }, []);

  const members = useMemo(
    () => [...membershipMembers, ...addedMembers],
    [addedMembers],
  );

  const gradeOptions = useMemo(
    () => [...new Set(members.map((member) => member.grade).filter(Boolean))].sort(),
    [members],
  );
  const societyOptions = useMemo(
    () => [...new Set([...Object.keys(ieeeSocietyMemberships), ...members.flatMap((member) => member.societies)])]
      .sort((left, right) => societyLabel(left).localeCompare(societyLabel(right))),
    [members],
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
    ["Adicionados", addedMembers.length],
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

  async function addMember(event) {
    event.preventDefault();
    const cleanMember = {
      ...memberForm,
      email: memberForm.email.trim(),
      memberNumber: memberForm.memberNumber.trim() || `manual-${Date.now()}`,
      name: memberForm.name.trim(),
      societies: [...new Set(memberForm.societies)].sort(),
    };

    if (!cleanMember.name || !cleanMember.email) {
      return;
    }

    setIsSaving(true);
    setStatus({ tone: "loading", text: "Salvando nova membresia." });

    try {
      const response = await fetch("/api/memberships", {
        body: JSON.stringify(cleanMember),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Não foi possível salvar a membresia.");
      }

      const payload = await response.json();
      setAddedMembers((current) => [...current, payload.member]);
      setMemberForm(emptyMemberForm());
      setStatus({ tone: "success", text: "Membresia adicionada ao banco." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível salvar a membresia." });
    } finally {
      setIsSaving(false);
    }
  }

  async function removeAddedMember(member) {
    if (!member.id) {
      return;
    }

    setIsSaving(true);
    setStatus({ tone: "loading", text: "Removendo membresia." });

    try {
      const response = await fetch(`/api/memberships/${member.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.detail || "Não foi possível remover a membresia.");
      }

      setAddedMembers((current) => current.filter((item) => item.id !== member.id));
      setStatus({ tone: "success", text: "Membresia removida." });
    } catch (error) {
      setStatus({ tone: "error", text: error.message || "Não foi possível remover a membresia." });
    } finally {
      setIsSaving(false);
    }
  }

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
            <p>{membershipSource.fileName} · {membershipSource.filters.join(" · ")}</p>
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
        </section>

        <section className="panel membership-add-panel">
          <div className="section-heading">
            <p className="panel-kicker">Cadastro manual</p>
            <h2>Adicionar membro</h2>
          </div>

          <form className="membership-add-form" onSubmit={addMember}>
            <label className="field">
              <span>Número IEEE</span>
              <input value={memberForm.memberNumber} onChange={(event) => updateMemberForm("memberNumber", event.target.value)} />
            </label>
            <label className="field">
              <span>Nome</span>
              <input required value={memberForm.name} onChange={(event) => updateMemberForm("name", event.target.value)} />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input required type="email" value={memberForm.email} onChange={(event) => updateMemberForm("email", event.target.value)} />
            </label>
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
              <button className="primary-button" disabled={isSaving}>Adicionar membro</button>
            </div>
          </form>
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
                {filteredMembers.map((member) => {
                  const isAddedMember = Boolean(member.id);

                  return (
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
                        {isAddedMember ? (
                          <button className="text-button danger" disabled={isSaving} type="button" onClick={() => removeAddedMember(member)}>
                            Remover
                          </button>
                        ) : "Planilha"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
