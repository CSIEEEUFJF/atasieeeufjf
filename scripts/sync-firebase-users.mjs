import "dotenv/config";

import { getPrisma } from "../src/lib/db.js";
import { syncFirebaseAuthUsers } from "../src/lib/firebase-auth-admin.js";
import { syncInternalUsersToFirebase } from "../src/lib/firebase-sync.js";

if (
  !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
  !process.env.FIREBASE_SERVICE_ACCOUNT_PATH &&
  !process.env.GOOGLE_APPLICATION_CREDENTIALS
) {
  console.warn("Firebase service account nao configurada; sync de usuarios Firebase foi pulado.");
  process.exit(0);
}

function chapterKeyFromRelation(chapter) {
  return String(typeof chapter === "string" ? chapter : chapter?.chapterKey || "").trim();
}

function publicSyncUser(row) {
  const chapters = Array.isArray(row.chapters)
    ? row.chapters.map(chapterKeyFromRelation).filter(Boolean)
    : [];
  const effectiveChapters = chapters.includes("RAS") && !chapters.includes("CAS")
    ? [...chapters, "CAS"]
    : chapters;

  return {
    chapters: effectiveChapters,
    email: row.email || "",
    id: row.id,
    isAdmin: Boolean(row.isAdmin),
    name: row.name || "",
  };
}

const rows = await getPrisma().user.findMany({
  include: { chapters: true },
  orderBy: { name: "asc" },
});
const users = rows.map(publicSyncUser);

await syncFirebaseAuthUsers(users);
await syncInternalUsersToFirebase(users);

console.log(`Usuários internos sincronizados com Firebase: ${users.length}`);
