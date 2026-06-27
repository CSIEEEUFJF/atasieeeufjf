import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PDFTEX_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), "texlive", "local", "pdftex");
const ENGINE_ROOTS = {
  pdftex: PDFTEX_ROOT,
};
const ALLOWED_ENGINES = new Set(Object.keys(ENGINE_ROOTS));
const PREFERRED_EXTENSIONS_BY_FORMAT = {
  3: [".tfm"],
  11: [".map"],
  10: [".fmt"],
  33: [".vf"],
  41: [".pgc"],
};

async function loadLocalManifest(engine) {
  const manifestPath = path.join(/*turbopackIgnore: true*/ ENGINE_ROOTS[engine], "manifest.json");
  try {
    const content = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(content);
    const byStem = {};

    for (const [basename, relativePath] of Object.entries(parsed.files || {})) {
      const stem = path.parse(basename).name;
      if (stem) {
        byStem[stem] ||= [];
        byStem[stem].push({ basename, relativePath });
      }
    }

    return {
      ...parsed,
      byStem,
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { byStem: {}, files: {} };
    }
    throw error;
  }
}

function resolveLocalRelativePath(manifest, filename, fileFormat) {
  if (manifest.files?.[filename]) {
    return manifest.files[filename];
  }

  const candidates = manifest.byStem?.[filename] || [];
  const preferredExtensions = PREFERRED_EXTENSIONS_BY_FORMAT[fileFormat] || [];

  for (const extension of preferredExtensions) {
    const match = candidates.find(({ basename }) => basename.endsWith(extension));
    if (match) {
      return match.relativePath;
    }
  }

  if (candidates.length === 1) {
    return candidates[0].relativePath;
  }

  return filename;
}

function resolveSafeCandidate(engineRoot, relativePath) {
  if (!relativePath || typeof relativePath !== "string") {
    return null;
  }

  const normalized = relativePath.replace(/\\/g, "/");
  if (
    path.posix.isAbsolute(normalized)
    || normalized.includes("\0")
  ) {
    return null;
  }

  const safeRelativePath = path.posix.normalize(normalized);
  if (
    safeRelativePath === "."
    || safeRelativePath === ".."
    || safeRelativePath.startsWith("../")
  ) {
    return null;
  }

  const candidate = path.resolve(/*turbopackIgnore: true*/ engineRoot, safeRelativePath);
  const relativeToRoot = path.relative(engineRoot, candidate);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return candidate;
}

async function tryServeLocal(engine, slug) {
  const filename = slug.at(-1);
  if (!filename) {
    return null;
  }

  const engineRoot = ENGINE_ROOTS[engine];
  const manifest = await loadLocalManifest(engine);
  const relativePath = slug[0] === "pk"
    ?manifest.files?.[`${filename}.pk`] || filename
    : resolveLocalRelativePath(manifest, filename, Number.parseInt(slug[0] || "", 10));

  const candidate = resolveSafeCandidate(engineRoot, relativePath);
  if (!candidate) {
    return null;
  }

  try {
    const content = await fs.readFile(candidate);
    const headers = new Headers({
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(content.byteLength),
      "content-type": "application/octet-stream",
    });

    headers.set(filename.endsWith(".pk") ?"pkid" : "fileid", path.basename(candidate));
    return new Response(content, { headers, status: 200 });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function GET(_request, context) {
  const params = await context.params;
  const engine = String(params.engine || "").trim();
  const slug = Array.isArray(params.slug) ?params.slug : [];

  if (!ALLOWED_ENGINES.has(engine) || !slug.length) {
    return NextResponse.json({ detail: "Caminho inválido." }, { status: 400 });
  }

  const localResponse = await tryServeLocal(engine, slug);
  if (localResponse) {
    return localResponse;
  }
  return new Response("File not found", {
    headers: {
      "cache-control": "no-store",
    },
    status: 404,
  });
}
