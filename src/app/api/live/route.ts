import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { alive: true, uptime: process.uptime(), timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
