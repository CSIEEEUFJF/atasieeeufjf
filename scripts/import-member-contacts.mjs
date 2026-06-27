import fs from "node:fs";
import path from "node:path";

import { getPrisma } from "../src/lib/db.js";

const SOCIETY_CODE_TO_CHAPTER = {
  MEMAES010: "AESS",
  MEMAP003: "APS",
  MEMCAS004: "CAS",
  MEMC016: "CS",
  MEMED015: "EdSoc",
  MEMIA034: "IAS",
  MEMMTT017: "MTTS",
  MEMPE031: "PES",
  MEMRA024: "RAS",
  MEMVT006: "VTS",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === "\"" && text[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const header = rows.shift() || [];
  return rows
    .filter((values) => values.some((value) => String(value || "").trim()))
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] || ""])));
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ?email : "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function matchScore(firstName, lastName, userName) {
  const sheetTokens = tokenSet(`${firstName} ${lastName}`);
  const userTokens = tokenSet(userName);
  if (!sheetTokens.size || !userTokens.size) {
    return 0;
  }

  let common = 0;
  sheetTokens.forEach((token) => {
    if (userTokens.has(token)) {
      common += 1;
    }
  });

  return common / Math.max(sheetTokens.size, userTokens.size);
}

function contactName(row) {
  const preferredName = String(row["Preferred Name"] || "").trim();
  const firstName = String(row["First Name"] || "").trim();
  const lastName = String(row["Last Name"] || "").trim();
  const visibleFirstName = preferredName && preferredName.toLowerCase() !== "nan"
    ?preferredName
    : firstName;

  return `${visibleFirstName} ${lastName}`.trim().replace(/\s+/g, " ");
}

function chaptersFromSocietyList(value) {
  const chapters = new Set(["Ramo"]);
  String(value || "")
    .split(/[;,]/)
    .map((code) => code.trim())
    .filter(Boolean)
    .forEach((code) => {
      const chapter = SOCIETY_CODE_TO_CHAPTER[code];
      if (chapter) {
        chapters.add(chapter);
      }
    });

  return [...chapters];
}

function memberNumber(row) {
  const rawValue = String(row["Member/Customer Number"] || "").trim();
  if (!rawValue || rawValue.toLowerCase() === "nan") {
    return null;
  }

  return rawValue.replace(/\.0$/, "");
}

function findLinkedUser(row, users) {
  const ranked = users
    .map((user) => ({
      score: matchScore(row["First Name"], row["Last Name"], user.name),
      user,
    }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];

  return best?.score >= 0.65 ?best.user : null;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    throw new Error("Uso: node scripts/import-member-contacts.mjs caminho/arquivo.csv");
  }

  const absoluteCsvPath = path.resolve(csvPath);
  const rows = parseCsv(fs.readFileSync(absoluteCsvPath, "utf8"));
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { email: true, id: true, name: true },
  });
  const stats = {
    imported: 0,
    linkedUsers: 0,
    skippedWithoutEmail: 0,
    updatedUserEmails: 0,
  };

  for (const row of rows) {
    const email = normalizeEmail(row["Email Address"] || row.email);
    if (!email) {
      stats.skippedWithoutEmail += 1;
      continue;
    }

    const linkedUser = findLinkedUser(row, users);
    const name = contactName(row) || linkedUser?.name || email;
    const data = {
      chapters: chaptersFromSocietyList(row["Society List"] || row.societyList),
      email,
      ieeeMemberNumber: memberNumber(row),
      name,
      source: "ieee_member_detail_view",
      userId: linkedUser?.id || null,
    };

    await prisma.memberContact.upsert({
      create: data,
      update: data,
      where: { email },
    });
    stats.imported += 1;

    if (linkedUser) {
      stats.linkedUsers += 1;
      if (String(linkedUser.email || "").endsWith("@local.atas-ieee")) {
        await prisma.user.update({
          data: { email },
          where: { id: linkedUser.id },
        });
        stats.updatedUserEmails += 1;
      }
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
