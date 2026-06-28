import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../lib/auth";
import { listInternalFiles, saveInternalFile } from "../../../../lib/internal-files";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  return NextResponse.json({ files: await listInternalFiles(user) });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Origem inválida." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((file) => file && typeof file.arrayBuffer === "function");
    const fallbackFile = formData.get("file");
    if (!files.length && fallbackFile && typeof fallbackFile.arrayBuffer === "function") {
      files.push(fallbackFile);
    }
    if (!files.length) {
      throw new Error("Envie pelo menos um arquivo válido.");
    }

    const description = formData.get("description") || "";
    const savedFiles = [];
    for (const file of files) {
      savedFiles.push(await saveInternalFile(user, file, { description }));
    }

    return NextResponse.json(
      { file: savedFiles[0] || null, files: savedFiles },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { detail: error.message || "Não foi possível salvar o arquivo." },
      { status: 400 },
    );
  }
}
