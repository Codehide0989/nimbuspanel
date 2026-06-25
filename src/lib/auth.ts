import { cookies } from "next/headers";
import { db } from "./db";
import { Role } from "@prisma/client";
import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "crypto";

const SESSION_COOKIE = "nimbus_session";
const SESSION_DURATION_DAYS = 30;
const REMEMBER_ME_DAYS = 90;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

// ─── Password Hashing ───────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  return verify(storedHash, password);
}

// ─── Session Management ─────────────────────────────────────────────

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string, rememberMe: boolean = false, ip?: string, ua?: string): Promise<string> {
  const token = generateSessionToken();
  const days = rememberMe ? REMEMBER_ME_DAYS : SESSION_DURATION_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { token, userId, expiresAt, ipAddress: ip, userAgent: ua },
  });

  return token;
}

export function setSessionCookie(token: string, rememberMe: boolean = false) {
  const days = rememberMe ? REMEMBER_ME_DAYS : SESSION_DURATION_DAYS;
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

// ─── Auth Verification ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  workspaceId: string;
  workspaceName: string;
  mustChangePass: boolean;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const token = getSessionToken();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { include: { teamMembers: { include: { workspace: true }, take: 1 } } } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }

  const user = session.user;
  if (!user.isActive) return null;

  const membership = user.teamMembers[0];
  if (!membership) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: membership.role,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    mustChangePass: user.mustChangePass,
  };
}

/**
 * Require authenticated user. Returns user or throws redirect.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
    // TypeScript: redirect throws, but TS doesn't know
    throw new Error("Redirect");
  }
  return user;
}

// ─── Login Logic ────────────────────────────────────────────────────

export interface LoginResult {
  success: boolean;
  error?: string;
  mustChangePassword?: boolean;
}

export async function login(email: string, password: string, rememberMe: boolean = false, ip?: string, ua?: string): Promise<LoginResult> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  if (!user) {
    return { success: false, error: "Invalid email or password" };
  }

  // Check lockout
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { success: false, error: `Account locked. Try again in ${mins} minutes.` };
  }

  if (!user.isActive) {
    return { success: false, error: "Account is disabled. Contact your administrator." };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    const updates: Record<string, unknown> = { failedLogins };

    if (failedLogins >= MAX_FAILED_LOGINS) {
      updates.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }

    await db.user.update({ where: { id: user.id }, data: updates });
    return { success: false, error: "Invalid email or password" };
  }

  // Reset failed logins on success
  await db.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  // Create session with rotated ID
  const token = await createSession(user.id, rememberMe, ip, ua);
  setSessionCookie(token, rememberMe);

  return { success: true, mustChangePassword: user.mustChangePass };
}

// ─── Logout ─────────────────────────────────────────────────────────

export async function logout() {
  const token = getSessionToken();
  if (token) {
    await db.session.deleteMany({ where: { token } });
  }
  clearSessionCookie();
}

// ─── Password Change ────────────────────────────────────────────────

export async function changePassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const { validatePassword } = await import("./password-policy");
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] };
  }

  const hash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: hash, mustChangePass: false },
  });

  // Invalidate all other sessions (session rotation)
  const currentToken = getSessionToken();
  await db.session.deleteMany({
    where: { userId, NOT: { token: currentToken ?? "" } },
  });

  return { success: true };
}

// ─── Password Reset ─────────────────────────────────────────────────

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.passwordReset.create({
    data: { token, userId: user.id, expiresAt },
  });

  return token;
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const reset = await db.passwordReset.findUnique({ where: { token } });
  if (!reset || reset.used || reset.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired reset link" };
  }

  const { validatePassword } = await import("./password-policy");
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] };
  }

  const hash = await hashPassword(newPassword);
  await db.user.update({ where: { id: reset.userId }, data: { passwordHash: hash } });
  await db.passwordReset.update({ where: { id: reset.id }, data: { used: true } });

  // Invalidate all sessions on password reset
  await db.session.deleteMany({ where: { userId: reset.userId } });

  return { success: true };
}
