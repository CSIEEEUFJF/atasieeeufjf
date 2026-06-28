import { NextResponse } from "next/server";

import { getCurrentUser, isSameOriginRequest } from "../../../../lib/auth";
import {
  listInternalFiles,
  saveInternalFile,
  StorageDisabledError,
  StorageUnavailableError,
} from "../../../../lib/internal-files";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
}

function storageUnavailable(error) {
  return NextResponse.json(
    { code: "storage_unavailable", detail: error.message || "Serviço de dados indisponível." },
    { status: 503 },
  );
}

function storageDisabled(error) {
  return NextResponse.json(
    { code: "storage_disabled", detail: error.message || "Armazenamento desabilitado por enquanto." },
    { status: 503 },
  );
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  try {
    return NextResponse.json({ files: await listInternalFiles(user) });
  } catch (error) {
    if (error instanceof StorageDisabledError) {
      return storageDisabled(error);
    }
    if (error instanceof StorageUnavailableError) {
      return storageUnavailable(error);
    }
    throw error;
  }
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
    if (error instanceof StorageDisabledError) {
      return storageDisabled(error);
    }
    if (error instanceof StorageUnavailableError) {
      return storageUnavailable(error);
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível salvar o arquivo." },
      { status: 400 },
    );
  }
}
