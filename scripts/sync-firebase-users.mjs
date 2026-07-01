import "dotenv/config";

import { syncUsersToFirebase } from "../src/lib/auth.js";

if (
  !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
  !process.env.FIREBASE_SERVICE_ACCOUNT_PATH &&
  !process.env.GOOGLE_APPLICATION_CREDENTIALS
) {
  console.warn("Firebase service account nao configurada; sync de usuarios Firebase foi pulado.");
  process.exit(0);
}

const total = await syncUsersToFirebase();
console.log(`Usuários internos sincronizados com Firebase: ${total}`);
