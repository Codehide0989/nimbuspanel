import { db } from "@/lib/db";
import { ActivityClient } from "./client";

export default async function ActivityPage() {
  let logs: Array<{
    id: string;
    action: string;
    target: string | null;
    ipAddress: string | null;
    createdAt: string;
    userEmail: string | null;
  }> = [];

  try {
    const entries = await db.activityLog.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    logs = entries.map((e) => ({
      id: e.id,
      action: e.action,
      target: e.target,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt.toISOString(),
      userEmail: e.user?.email ?? null,
    }));
  } catch {
    // DB error
  }

  return <ActivityClient logs={logs} />;
}
