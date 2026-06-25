import { Role } from "@prisma/client";

/**
 * Masks sensitive server fields for READ_ONLY users.
 * Only returns safe fields; infrastructure details are hidden.
 */
export function maskServerData<T extends Record<string, unknown>>(data: T, role: Role): T {
  if (role === "OWNER" || role === "ADMIN" || role === "OPERATOR" || role === "SSH_USER") {
    return data;
  }

  // READ_ONLY: mask sensitive fields
  const masked = { ...data };
  const sensitiveFields = [
    "publicIp", "privateIp", "hostname", "username", "sshPort",
    "pemKeyS3Key", "kernel", "filesystem", "notes",
  ];

  for (const field of sensitiveFields) {
    if (field in masked) {
      (masked as Record<string, unknown>)[field] = "••••••••";
    }
  }

  return masked;
}

/**
 * Check if a role can see sensitive infrastructure data.
 */
export function canViewSensitiveData(role: Role): boolean {
  return role !== "READ_ONLY";
}
