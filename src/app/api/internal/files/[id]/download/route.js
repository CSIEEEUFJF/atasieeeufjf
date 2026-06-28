import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../../../lib/auth";
import {
  getInternalFileForDownload,
  StorageDisabledError,
  StorageUnavailableError,
} from "../../../../../../lib/internal-files";

export const runtime = "nodejs";

function safeDownloadName(value) {
  return String(value || "arquivo")
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]+/g, "-")
    .slice(0, 180);
}

export async function GET(request, context) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
  }

  let result;
  try {
    const params = await context.params;
    result = await getInternalFileForDownload(user, params.id);
    if (!result) {
      return NextResponse.json({ detail: "Arquivo não encontrado." }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof StorageDisabledError) {
      return NextResponse.redirect(new URL("/arquivos", request.url), 302);
    }
    if (error instanceof StorageUnavailableError) {
      return NextResponse.redirect(new URL("/offline", request.url), 302);
    }
    throw error;
  }

  const fileName = safeDownloadName(result.row.originalName);
  return new NextResponse(result.data, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(result.data.byteLength),
      "Content-Type": result.row.mimeType || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
