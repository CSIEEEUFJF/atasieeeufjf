import { NextResponse } from "next/server";

import { getFirebaseMobileUser } from "../../../../../lib/firebase-mobile-auth";
import {
  createInternalTask,
  InternalAccessError,
  listInternalTasks,
} from "../../../../../lib/internal";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ detail: "Autenticacao Firebase necessaria." }, { status: 401 });
}

export async function GET(request) {
  const user = await getFirebaseMobileUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      tasks: await listInternalTasks(user, searchParams.get("chapter") || ""),
    });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    throw error;
  }
}

export async function POST(request) {
  const user = await getFirebaseMobileUser(request);
  if (!user) {
    return unauthorized();
  }

  try {
    const task = await createInternalTask(user, await request.json());
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof InternalAccessError) {
      return NextResponse.json({ detail: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { detail: error.message || "Não foi possível salvar a tarefa." },
      { status: 400 },
    );
  }
}
