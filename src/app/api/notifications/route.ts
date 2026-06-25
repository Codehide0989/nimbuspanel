import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function getUserFromSession(request: NextRequest) {
  const token = request.cookies.get("nimbus_session")?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function GET(request: NextRequest) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ data: [], unreadCount: 0 });

  try {
    const notifications = await db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await db.notification.count({
      where: { userId: user.id, read: false },
    });

    return NextResponse.json({ data: notifications, unreadCount });
  } catch {
    return NextResponse.json({ data: [], unreadCount: 0 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUserFromSession(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      await db.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await db.notification.update({
        where: { id: notificationId },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
