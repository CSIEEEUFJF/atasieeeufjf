import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

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

if (process.env.DATABASE_URL) {
  runNodeScript("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
} else {
  console.warn("DATABASE_URL nao definida; pulando prisma migrate deploy.");
}

runNodeScript("node_modules/next/dist/bin/next", ["build"]);
