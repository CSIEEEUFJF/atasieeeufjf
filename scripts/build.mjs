import { spawnSync } from "node:child_process";

function runNodeScript(scriptPath, args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runNodeScript("node_modules/prisma/build/index.js", ["generate"]);

if (process.env.DATABASE_URL) {
  runNodeScript("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
} else {
  console.warn("DATABASE_URL nao definida; pulando prisma migrate deploy.");
}

runNodeScript("node_modules/next/dist/bin/next", ["build"]);
