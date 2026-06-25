import { db } from "./db";

export type NotificationType = "info" | "success" | "warning" | "error";

export async function createNotification(params: {
  userId: string;
  workspaceId: string;
  title: string;
  message: string;
  type?: NotificationType;
}): Promise<void> {
  try {
    await db.notification.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        title: params.title,
        message: params.message,
        type: params.type ?? "info",
      },
    });
  } catch (error) {
    console.error("[Notification] Failed:", error);
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await db.notification.count({
      where: { userId, read: false },
    });
  } catch {
    return 0;
  }
}

export async function markAsRead(notificationId: string): Promise<void> {
  await db.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string, workspaceId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, workspaceId, read: false },
    data: { read: true },
  });
}
