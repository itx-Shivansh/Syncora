import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

  try {
    // Execute lightweight raw query and query domain model count
    await prisma.$queryRaw`SELECT 1`;
    const workspaceCount = await prisma.workspace.count();
    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: "connected",
          latencyMs,
          workspaces: workspaceCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        status: "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: {
          status: "disconnected",
          latencyMs,
          error: error instanceof Error ? error.message : "Unknown database connection error",
        },
      },
      { status: 503 }
    );
  }
}
