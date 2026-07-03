import { NextResponse } from "next/server";

import { ieeeSocietyMemberships } from "../../../data/membership-members";
import {
  canManageMembers,
  getCurrentUser,
  isSameOriginRequest,
} from "../../../lib/auth";
import { getPrisma } from "../../../lib/db";

export const runtime = "nodejs";

const CHAPTER_OPTIONS = ["Ramo", "AESS", "APS", "CAS", "CS", "EDSOC", "IAS", "MTTS", "PES", "RAS", "SIGHT", "VTS", "WIE"];
const ROLE_OPTIONS = ["Membro", "Presidente", "Vice-Presidente", "Tesoureiro", "Secretário", "Webmaster", "Conselheiro"];

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

function forbidden() {
  return NextResponse.json(
    { detail: "Apenas a diretoria pode gerenciar membresias." },
    { status: 403 },
  );
}

function sanitizeText(value, maxLength = 180) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeSocieties(value) {
  const requested = Array.isArray(value) ? value : [];
  const allowed = new Set(Object.keys(ieeeSocietyMemberships));

  return [...new Set(requested.map((item) => sanitizeText(item, 40)).filter((item) => allowed.has(item)))];
}

function sanitizeVolunteerStatus(value) {
  const cleanValue = sanitizeText(value, 40);
  return ["Voluntário", "Inativo", "Sem vínculo"].includes(cleanValue) ? cleanValue : "Voluntário";
}

function sanitizeMainChapter(value) {
  const cleanValue = sanitizeText(value, 40);
  const normalizedValue = cleanValue === "EdSoc" ? "EDSOC" : cleanValue;
  return CHAPTER_OPTIONS.includes(normalizedValue) ? normalizedValue : "Ramo";
}

function sanitizeRole(value) {
  const cleanValue = sanitizeText(value, 80);
  return ROLE_OPTIONS.includes(cleanValue) ? cleanValue : "Membro";
}

function membershipMember(row) {
  return {
    city: row.city || "",
    email: row.email || "",
    grade: row.grade || "Student Member",
    id: row.id,
    ieeeStatus: row.ieeeStatus || "Active",
    isDeleted: Boolean(row.isDeleted),
    mainChapter: row.mainChapter || "Ramo",
    memberNumber: row.memberNumber,
    name: row.name,
    renewYear: row.renewYear || "",
    section: row.section || "",
    societies: Array.isArray(row.societies) ? row.societies : [],
    role: row.role || "Membro",
    source: row.source || "manual",
    state: row.state || "",
    volunteerStatus: row.volunteerStatus || "Voluntário",
  };
}

function sanitizePayload(payload = {}) {
  const name = sanitizeText(payload.name);
  const email = sanitizeText(payload.email, 220).toLowerCase();
  const memberNumber = sanitizeText(payload.memberNumber, 80) || `manual-${Date.now()}`;

  if (!name) {
    throw new Error("Informe o nome do membro.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }

  return {
    city: sanitizeText(payload.city, 120),
    email,
    grade: sanitizeText(payload.grade, 80) || "Student Member",
    ieeeStatus: sanitizeText(payload.ieeeStatus, 80) || "Active",
    mainChapter: sanitizeMainChapter(payload.mainChapter),
    memberNumber,
    name,
    renewYear: sanitizeText(payload.renewYear, 20),
    section: sanitizeText(payload.section, 120),
    societies: sanitizeSocieties(payload.societies),
    role: sanitizeRole(payload.role),
    isDeleted: false,
    source: sanitizeText(payload.source, 40) || "manual",
    state: sanitizeText(payload.state, 120),
    volunteerStatus: sanitizeVolunteerStatus(payload.volunteerStatus),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!canManageMembers(user)) {
    return forbidden();
  }

  const rows = await getPrisma().membershipMember.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ members: rows.map(membershipMember) });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem inválida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  if (!canManageMembers(user)) {
    return forbidden();
  }

  try {
    const payload = await request.json();
    const data = sanitizePayload(payload);
    const row = await getPrisma().membershipMember.upsert({
      create: data,
      update: data,
      where: { memberNumber: data.memberNumber },
    });

    return NextResponse.json({ member: membershipMember(row) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível criar a membresia." },
      { status: 400 },
    );
  }
}
