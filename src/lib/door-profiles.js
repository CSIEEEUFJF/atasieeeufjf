import { normalizarSociedadeChave } from "./ata";
import { getPrisma } from "./db";

const DOOR_SOURCE_HOST = "192.168.11.2";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Mn}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function readString(value) {
  return String(value || "").trim();
}

function readJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function chapterKeyFromRelation(relation) {
  return normalizarSociedadeChave(relation?.chapterKey || relation || "", "");
}

function normalizeChapterRoles(value, chapters = [], fallbackRole = "") {
  const roles = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const fromRoles = Object.fromEntries(
    Object.entries(roles)
      .map(([chapter, role]) => [
        normalizarSociedadeChave(chapter, ""),
        readString(role || fallbackRole || "Membro") || "Membro",
      ])
      .filter(([chapter]) => chapter),
  );

  if (Object.keys(fromRoles).length) {
    return fromRoles;
  }

  return Object.fromEntries(
    chapters
      .map(chapterKeyFromRelation)
      .filter(Boolean)
      .map((chapter) => [chapter, readString(fallbackRole) || "Membro"]),
  );
}

function publicDoorProfile(row) {
  if (!row) {
    return null;
  }

  return {
    cardCount: row.cardCount || 0,
    chapter: row.chapter || "",
    chapterRoles: row.chapterRoles || {},
    chapters: readJsonArray(row.chapters),
    doorChapter: row.doorChapter || "",
    doorProfileIndex: row.doorProfileIndex,
    doorProfileName: row.doorProfileName || "",
    doorRole: row.doorRole || "",
    firebaseUid: row.firebaseUid || "",
    hasDoorCards: Boolean(row.hasDoorCards),
    id: row.id,
    internalUserDocumentId: row.internalUserDocumentId || "",
    internalUserId: row.internalUserIdText || "",
    matchMethod: row.matchMethod || "",
    matchScore: row.matchScore || 0,
    name: row.name || "",
    role: row.role || "",
    username: row.username || "",
  };
}

function parseDoorProfiles(rawJson) {
  const root = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  const rows = Array.isArray(root)
    ?root
    :Array.isArray(root?.users)
      ?root.users
      :Array.isArray(root?.profiles)
        ?root.profiles
        :[];

  return rows.map((row, rowIndex) => {
    const name = readString(row?.name || row?.nome);
    if (!name) {
      return null;
    }

    const cards = Array.isArray(row?.cards) ?row.cards : [];
    const cardsCsv = readString(row?.cards_csv || row?.cardsCsv);
    const cardCount = cards.length || (cardsCsv ?cardsCsv.split(/[,;]/).filter((item) => item.trim()).length : 0);

    return {
      cardCount: cardCount || (readString(row?.uid) ?1 : 0),
      chapter: readString(row?.chapter || row?.capitulo || row?.branch),
      index: Number.isSafeInteger(Number(row?.index ?? row?.id)) ?Number(row?.index ?? row?.id) : rowIndex,
      isAdmin: Boolean(row?.is_admin || row?.isAdmin),
      name,
      photoId: readString(row?.photo_id || row?.photoId),
      role: readString(row?.role || row?.cargo),
    };
  }).filter(Boolean);
}

function scoreDoorProfile(profile, user) {
  const doorName = normalizeText(profile.name);
  const userName = normalizeText(user.name);
  if (!doorName || !userName) {
    return { method: "empty", value: 0 };
  }

  const doorChapter = normalizarSociedadeChave(profile.chapter, "");
  const chapterOverlap = Boolean(doorChapter && Object.keys(user.chapterRoles).includes(doorChapter));

  if (doorName === userName) {
    return { method: chapterOverlap ?"name_chapter" : "name", value: chapterOverlap ?1 : 0.94 };
  }

  if (doorName.includes(userName) || userName.includes(doorName)) {
    return {
      method: chapterOverlap ?"name_similarity_chapter" : "name_similarity",
      value: chapterOverlap ?0.9 : 0.84,
    };
  }

  const doorTokens = new Set(doorName.split(" ").filter((item) => item.length > 1));
  const userTokens = new Set(userName.split(" ").filter((item) => item.length > 1));
  if (!doorTokens.size || !userTokens.size) {
    return { method: "name_tokens", value: 0 };
  }

  const overlap = [...doorTokens].filter((item) => userTokens.has(item)).length;
  const dice = (2 * overlap) / (doorTokens.size + userTokens.size);
  return {
    method: chapterOverlap ?"name_tokens_chapter" : "name_tokens",
    value: 0.62 + 0.28 * dice + (chapterOverlap ?0.06 : 0),
  };
}

async function internalImportUsers() {
  const users = await getPrisma().user.findMany({
    include: { chapters: true },
    orderBy: { name: "asc" },
  });

  return users.map((user) => {
    const chapters = user.chapters.map(chapterKeyFromRelation).filter(Boolean);
    const chapterRoles = normalizeChapterRoles(user.chapterRoles, chapters, user.cargo);

    return {
      chapterRoles,
      chapters,
      documentId: String(user.id),
      email: user.email || "",
      firebaseUid: "",
      internalUserId: String(user.id),
      name: user.name || "",
      role: user.cargo || "",
      userId: user.id,
      username: user.username || "",
    };
  });
}

function matchDoorProfiles(doorProfiles, internalUsers) {
  const candidates = doorProfiles.flatMap((profile) =>
    internalUsers.map((user) => {
      const score = scoreDoorProfile(profile, user);
      return score.value < 0.84 ?null : { doorProfile: profile, internalUser: user, ...score };
    }).filter(Boolean),
  ).sort((a, b) => b.value - a.value || a.doorProfile.index - b.doorProfile.index);

  const usedProfiles = new Set();
  const usedUsers = new Set();
  const matches = [];
  for (const candidate of candidates) {
    if (!usedProfiles.has(candidate.doorProfile.index) && !usedUsers.has(candidate.internalUser.documentId)) {
      usedProfiles.add(candidate.doorProfile.index);
      usedUsers.add(candidate.internalUser.documentId);
      matches.push(candidate);
    }
  }

  return {
    matches: matches.sort((a, b) => a.doorProfile.index - b.doorProfile.index),
    unmatchedDoorProfiles: doorProfiles.filter((profile) => !usedProfiles.has(profile.index)),
    unmatchedInternalUsers: internalUsers.filter((user) => !usedUsers.has(user.documentId)),
  };
}

export async function listDoorProfiles() {
  const profiles = await getPrisma().doorProfile.findMany({
    orderBy: [{ name: "asc" }, { doorProfileIndex: "asc" }],
  });
  return profiles.map(publicDoorProfile);
}

export async function importDoorProfiles(rawJson) {
  const doorProfiles = parseDoorProfiles(rawJson);
  if (!doorProfiles.length) {
    throw new Error("Nenhum perfil válido foi encontrado no JSON.");
  }

  const internalUsers = await internalImportUsers();
  const report = matchDoorProfiles(doorProfiles, internalUsers);

  await getPrisma().$transaction(
    report.matches.map((match) => {
      const user = match.internalUser;
      const profile = match.doorProfile;
      const chapters = Object.keys(user.chapterRoles).sort();

      return getPrisma().doorProfile.upsert({
        create: {
          cardCount: profile.cardCount,
          chapter: normalizarSociedadeChave(profile.chapter, "") || chapters[0] || "",
          chapterRoles: user.chapterRoles,
          chapters,
          doorChapter: profile.chapter,
          doorProfileIndex: profile.index,
          doorProfileName: profile.name,
          doorRole: profile.role,
          doorSource: DOOR_SOURCE_HOST,
          email: user.email,
          hasDoorCards: profile.cardCount > 0,
          internalUserDocumentId: user.documentId,
          internalUserIdText: user.internalUserId,
          matchMethod: match.method,
          matchScore: Math.round(match.value * 10000) / 10000,
          name: user.name,
          role: user.role,
          userId: user.userId,
          username: user.username,
        },
        update: {
          cardCount: profile.cardCount,
          chapter: normalizarSociedadeChave(profile.chapter, "") || chapters[0] || "",
          chapterRoles: user.chapterRoles,
          chapters,
          doorChapter: profile.chapter,
          doorProfileName: profile.name,
          doorRole: profile.role,
          doorSource: DOOR_SOURCE_HOST,
          email: user.email,
          hasDoorCards: profile.cardCount > 0,
          internalUserDocumentId: user.documentId,
          internalUserIdText: user.internalUserId,
          matchMethod: match.method,
          matchScore: Math.round(match.value * 10000) / 10000,
          name: user.name,
          role: user.role,
          userId: user.userId,
          username: user.username,
        },
        where: { doorProfileIndex: profile.index },
      });
    }),
  );

  return {
    matches: report.matches.map((match) => ({
      doorProfile: match.doorProfile,
      internalUser: match.internalUser,
      method: match.method,
      score: match.value,
    })),
    unmatchedDoorProfiles: report.unmatchedDoorProfiles,
    unmatchedInternalUsers: report.unmatchedInternalUsers,
  };
}
