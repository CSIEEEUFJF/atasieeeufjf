import { NextResponse } from "next/server";

import { getChapterOptions, getCurrentUser, hasUsers } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({
    chapters: getChapterOptions(),
    setupRequired: !hasUsers(),
    user,
  });
}
