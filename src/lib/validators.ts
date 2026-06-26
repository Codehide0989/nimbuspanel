import { z } from "zod";

export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "OPERATOR", "SSH_USER", "READ_ONLY"]),
  workspaceId: z.string().optional(), // resolved server-side from session
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
