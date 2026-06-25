/**
 * Server-side security utilities.
 * Authorization checks for server actions and API routes.
 */

import { getAuthUser, type AuthUser } from "./auth";
import { hasPermission, type Permission } from "./permissions";

export class UnauthorizedError extends Error {
  constructor(message: string = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Require authenticated user in server actions.
 * Returns user or throws.
 */
export async function requireAuthAction(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Require specific permission for a server action.
 */
export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireAuthAction();
  if (!hasPermission(user.role, permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return user;
}

/**
 * Sanitize error messages for client responses.
 * Never expose internal details.
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof UnauthorizedError) return "Authentication required";
  if (error instanceof ForbiddenError) return "You do not have permission for this action";

  // Never expose raw DB/AWS/internal errors to client
  const msg = error instanceof Error ? error.message : "";

  if (msg.includes("Unique constraint")) return "A record with this value already exists";
  if (msg.includes("Foreign key")) return "Referenced record not found";
  if (msg.includes("connect ECONNREFUSED")) return "Service temporarily unavailable";
  if (msg.includes("ETIMEDOUT")) return "Request timed out";
  if (msg.includes("credential")) return "Authentication with external service failed";

  return "An unexpected error occurred. Please try again.";
}

/**
 * Validate that a string looks like a CUID (Prisma default IDs).
 */
export function isValidId(id: string): boolean {
  return /^c[a-z0-9]{24}$/.test(id);
}

/**
 * Validate IPv4 address format.
 */
export function isValidIpv4(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split(".").every((n) => parseInt(n) >= 0 && parseInt(n) <= 255);
}
