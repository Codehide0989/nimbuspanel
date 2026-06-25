import { NextResponse } from "next/server";
import { isDatabaseHealthy } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbHealth = await isDatabaseHealthy();

  if (!dbHealth.healthy) {
    return NextResponse.json(
      { ready: false, reason: "Database unavailable", error: dbHealth.error },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { ready: true, latencyMs: dbHealth.latencyMs },
    { status: 200 }
  );
}
