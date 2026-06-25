import { Role } from "@prisma/client";

export type Permission =
  | "vps:read"
  | "vps:start"
  | "vps:stop"
  | "vps:reboot"
  | "vps:terminate"
  | "vps:create"
  | "vps:delete"
  | "vps:ssh"
  | "users:read"
  | "users:invite"
  | "users:remove"
  | "users:update_role"
  | "files:read"
  | "files:upload"
  | "files:delete"
  | "workspace:settings"
  | "workspace:delete";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "vps:read", "vps:start", "vps:stop", "vps:reboot", "vps:terminate", "vps:create", "vps:delete", "vps:ssh",
    "users:read", "users:invite", "users:remove", "users:update_role",
    "files:read", "files:upload", "files:delete",
    "workspace:settings", "workspace:delete",
  ],
  ADMIN: [
    "vps:read", "vps:start", "vps:stop", "vps:reboot", "vps:terminate", "vps:create", "vps:delete", "vps:ssh",
    "users:read", "users:invite", "users:remove", "users:update_role",
    "files:read", "files:upload", "files:delete",
    "workspace:settings",
  ],
  OPERATOR: [
    "vps:read", "vps:start", "vps:stop", "vps:reboot",
    "files:read",
    "users:read",
  ],
  SSH_USER: [
    "vps:read", "vps:ssh",
    "files:read",
    "users:read",
  ],
  READ_ONLY: [
    "vps:read",
    "files:read",
    "users:read",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    OPERATOR: "Operator",
    SSH_USER: "SSH User",
    READ_ONLY: "Read Only",
  };
  return labels[role];
}
