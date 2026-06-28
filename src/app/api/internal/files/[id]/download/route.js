import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../../../lib/auth";
import { getInternalFileForDownload } from "../../../../../../lib/internal-files";

export const runtime = "nodejs";

function safeDownloadName(value) {
  return String(value || "arquivo")
    .replace(/[\r\n"]/g, "")
    .replace(/[\\/]+/g, "-")
    .slice(0, 180);
}

export async function GET(_request, context) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Autenticação necessária." }, { status: 401 });
  }

  const params = await context.params;
  const result = await getInternalFileForDownload(user, params.id);
  if (!result) {
    return NextResponse.json({ detail: "Arquivo não encontrado." }, { status: 404 });
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
