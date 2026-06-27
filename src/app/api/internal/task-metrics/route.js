import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/auth";
import {
  InternalAccessError,
  listTaskMetricsByChapter,
} from "../../../../lib/internal";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao necessaria." }, { status: 401 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return unauthorized();
  }

  try {
    return NextResponse.json({
      chapters: await listTaskMetricsByChapter(user),
    });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    throw error;
  }
}
