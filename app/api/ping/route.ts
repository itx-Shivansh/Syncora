import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight liveness probe — always returns 200 once the server is up. */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
