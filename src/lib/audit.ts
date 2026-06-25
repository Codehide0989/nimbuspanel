import { db, withRetry } from "./db";
import { createNotification } from "./notifications";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "vps.created"
  | "vps.deleted"
  | "vps.started"
  | "vps.stopped"
  | "vps.rebooted"
  | "vps.terminated"
  | "ssh.opened"
  | "ssh.closed"
  | "file.uploaded"
  | "file.deleted"
  | "file.downloaded"
  | "user.invited"
  | "invitation.accepted"
  | "invitation.revoked"
  | "workspace.created"
  | "aws.connected"
  | "aws.disconnected"
  | "aws.synced";

interface AuditLogParams {
  action: AuditAction | string;
  userId?: string;
  workspaceId: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Actions that generate notifications
const NOTIFIABLE_ACTIONS: Record<string, { title: string; type: "info" | "success" | "warning" | "error" }> = {
  "vps.started": { title: "Server Started", type: "success" },
  "vps.stopped": { title: "Server Stopped", type: "warning" },
  "vps.terminated": { title: "Server Terminated", type: "error" },
  "aws.synced": { title: "AWS Sync Complete", type: "success" },
  "file.uploaded": { title: "Upload Complete", type: "info" },
  "invitation.accepted": { title: "Invite Accepted", type: "success" },
  "user.invited": { title: "User Invited", type: "info" },
};

export async function logActivity(params: AuditLogParams): Promise<void> {
  try {
    await withRetry(() =>
      db.activityLog.create({
        data: {
          action: params.action,
          userId: params.userId,
          workspaceId: params.workspaceId,
          target: params.target,
          metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      })
    );

    // Generate notification if applicable
    const notif = NOTIFIABLE_ACTIONS[params.action];
    if (notif && params.userId) {
      await createNotification({
        userId: params.userId,
        workspaceId: params.workspaceId,
        title: notif.title,
        message: params.target ? `${notif.title}: ${params.target}` : notif.title,
        type: notif.type,
      });
    }
  } catch (error) {
    console.error("[AuditLog] Failed:", error);
  }
}
