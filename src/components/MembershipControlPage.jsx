"use client";

import { useMemo, useState } from "react";

import { membershipMembers, membershipSource } from "../data/membership-members";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueCount(items, getter) {
  return new Set(items.map(getter).filter(Boolean)).size;
}

export default function MembershipControlPage({ user }) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [society, setSociety] = useState("all");

  const gradeOptions = useMemo(
    () => [...new Set(membershipMembers.map((member) => member.grade).filter(Boolean))].sort(),
    [],
  );
  const societyOptions = useMemo(
    () => [...new Set(membershipMembers.flatMap((member) => member.societies))].sort(),
    [],
  );
  const filteredMembers = useMemo(() => {
    const search = normalizeSearch(query);

    return membershipMembers.filter((member) => {
      const haystack = normalizeSearch([
        member.memberNumber,
        member.name,
        member.email,
        member.city,
        member.section,
        member.societies.join(" "),
      ].join(" "));
      const matchesSearch = !search || haystack.includes(search);
      const matchesGrade = grade === "all" || member.grade === grade;
      const matchesSociety = society === "all" || member.societies.includes(society);

      return matchesSearch && matchesGrade && matchesSociety;
    });
  }, [grade, query, society]);

  const stats = [
    ["Membros", membershipMembers.length],
    ["Ativos", membershipMembers.filter((member) => member.ieeeStatus === "Active").length],
    ["Sociedades", societyOptions.length],
    ["Renovação", uniqueCount(membershipMembers, (member) => member.renewYear)],
  ];

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
              {societyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
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
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.memberNumber}>
                    <td>{member.memberNumber}</td>
                    <td><strong>{member.name}</strong></td>
                    <td><a href={`mailto:${member.email}`}>{member.email}</a></td>
                    <td>{member.grade}</td>
                    <td>{member.ieeeStatus}</td>
                    <td>{member.renewYear}</td>
                    <td>{[member.city, member.state || member.section].filter(Boolean).join(" / ")}</td>
                    <td>{member.societies.length ? member.societies.join(", ") : "Sem sociedade"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
