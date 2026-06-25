import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "OPERATOR", "SSH_USER", "READ_ONLY"]),
  workspaceId: z.string().optional(), // resolved server-side from session
});

export const createVpsSchema = z.object({
  instanceId: z.string().min(1, "Instance ID is required"),
  displayName: z.string().min(1, "Display name is required").max(100),
  description: z.string().max(500).optional(),
  region: z.string().min(1),
  instanceType: z.string().min(1),
  publicIp: z.string().optional(),
  privateIp: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1).default("ubuntu"),
  workspaceId: z.string().min(1),
  pemKeyS3Key: z.string().optional(),
  connectionType: z.enum(["aws", "manual"]).default("manual"),
});

// Manual VPS requires PEM key
export const createManualVpsSchema = createVpsSchema.extend({
  connectionType: z.literal("manual"),
  publicIp: z.string().min(1, "Public IP is required for manual VPS"),
  pemKeyS3Key: z.string().min(1, "PEM key is required for SSH authentication"),
});

export const vpsActionSchema = z.object({
  vpsId: z.string().min(1),
  action: z.enum(["start", "stop", "reboot", "terminate"]),
});

export const fileUploadSchema = z.object({
  category: z.enum(["avatars", "pem-keys", "configs", "backups", "logs"]),
  userId: z.string().min(1),
  workspaceId: z.string().min(1),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "Workspace name must be at least 2 characters").max(50),
});

export const testSSHSchema = z.object({
  host: z.string().min(1, "Host is required"),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, "Username is required"),
  pemKeyS3Key: z.string().min(1, "PEM key is required"),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type CreateVpsInput = z.infer<typeof createVpsSchema>;
export type CreateManualVpsInput = z.infer<typeof createManualVpsSchema>;
export type VpsActionInput = z.infer<typeof vpsActionSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type TestSSHInput = z.infer<typeof testSSHSchema>;
