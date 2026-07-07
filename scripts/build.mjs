import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

function runNodeScript(scriptPath, args, options = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    env: {
      ...process.env,
      ...(options.env || {}),
    },
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

function copyPdftexMapToPublic() {
  const manifestPath = path.join(process.cwd(), "texlive", "local", "pdftex", "manifest.json");
  const fallbackRelativePath = path.join("files", "fonts", "map", "pdftex", "updmap", "pdftex.map");
  let relativePath = fallbackRelativePath;

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    relativePath = manifest.files?.["pdftex.map"] || fallbackRelativePath;
  } catch {
    console.warn("Manifest TeX nao encontrado; usando caminho padrao para pdftex.map.");
  }

  const source = path.join(process.cwd(), "texlive", "local", "pdftex", relativePath);
  const targetDir = path.join(process.cwd(), "public", "swiftlatex");
  const target = path.join(targetDir, "pdftex.map");

  if (!existsSync(source)) {
    console.warn(`pdftex.map nao encontrado em ${source}; asset estatico nao sera atualizado.`);
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(source, target);
}

runNodeScript("node_modules/prisma/build/index.js", ["generate"]);
copyPdftexMapToPublic();

const migrationDatabaseUrl = process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL;

if (migrationDatabaseUrl) {
  runNodeScript(
    "node_modules/prisma/build/index.js",
    ["db", "push", "--accept-data-loss"],
    { env: { DATABASE_URL: migrationDatabaseUrl } },
  );

  if (process.env.SITE_PROJECTS_SEED_ON_BUILD !== "false") {
    runNodeScript("scripts/seed-site-chapter-projects.mjs", [], {
      env: { DATABASE_URL: migrationDatabaseUrl },
    });
  }

  if (process.env.FIREBASE_SYNC_USERS_ON_BUILD !== "false") {
    runNodeScript("scripts/sync-firebase-users.mjs", [], {
      env: { DATABASE_URL: migrationDatabaseUrl },
    });
  }
} else {
  console.warn("PRISMA_DATABASE_URL/DATABASE_URL nao definida; pulando prisma db push, seed de projetos e sync de usuarios Firebase.");
}

runNodeScript("node_modules/next/dist/bin/next", ["build"]);
