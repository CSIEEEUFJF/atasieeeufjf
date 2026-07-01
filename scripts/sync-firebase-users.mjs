import "dotenv/config";

import { syncUsersToFirebase } from "../src/lib/auth.js";

const total = await syncUsersToFirebase();
console.log(`Usuários internos sincronizados com Firebase: ${total}`);
