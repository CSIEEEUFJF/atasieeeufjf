import { promises as fs } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { SOCIEDADES } from "../../../../lib/ata";

export const runtime = "nodejs";

async function collectFiles(baseDir, relativeDir = "") {
  const currentDir = path.join(baseDir, relativeDir);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryRelativePath = relativeDir
      ?`${relativeDir}/${entry.name}`
      : entry.name;
    const entryAbsolutePath = path.join(baseDir, entryRelativePath);

    if (entry.isDirectory()) {
      if (entry.name === "imagens") {
        files.push(...(await collectFiles(baseDir, entryRelativePath)));
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (entry.name.endsWith(".cls")) {
      files.push({
        content: await fs.readFile(entryAbsolutePath, "utf8"),
        encoding: "utf8",
        path: entryRelativePath.replace(/\\/g, "/"),
      });
      continue;
    }

    if (entryRelativePath.startsWith("imagens/")) {
      files.push({
        content: (await fs.readFile(entryAbsolutePath)).toString("base64"),
        encoding: "base64",
        path: entryRelativePath.replace(/\\/g, "/"),
      });
    }
  }

  return files;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sociedade = searchParams.get("sociedade")?.trim() || "";

  if (!sociedade || !SOCIEDADES[sociedade]) {
    return NextResponse.json(
      { detail: "Sociedade invalida." },
      { status: 400 },
    );
  }

  const config = SOCIEDADES[sociedade];
  const files = await collectFiles(config.folder);

  return NextResponse.json(
    {
      documentclass: config.documentclass,
      files,
      sociedade,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
