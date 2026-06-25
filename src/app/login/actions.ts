"use server";

import { headers } from "next/headers";
import { login } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { db } from "@/lib/db";
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

export async function loginAction(input: LoginInput) {
  const { email, password, rememberMe } = input;
  const headersList = headers();
  const ip = getClientIp(headersList);
  const ua = headersList.get("user-agent") ?? undefined;

  // Rate limit check
  const rateCheck = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
  if (!rateCheck.allowed) {
    const retryMins = Math.ceil(rateCheck.retryAfterMs / 60000);
    return { error: `Too many login attempts. Try again in ${retryMins} minutes.` };
  }

  const result = await login(email, password, rememberMe, ip, ua);

  if (result.success) {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { teamMembers: true },
    });
    if (user && user.teamMembers[0]) {
      await logActivity({
        action: "user.login",
        userId: user.id,
        workspaceId: user.teamMembers[0].workspaceId,
        target: user.email,
        ipAddress: ip,
        userAgent: ua,
      });
    }
    return { success: true, mustChangePassword: result.mustChangePassword };
  }

  // Log failed attempt
  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { teamMembers: true },
    });
    if (user && user.teamMembers[0]) {
      await logActivity({
        action: "user.login_failed",
        userId: user.id,
        workspaceId: user.teamMembers[0].workspaceId,
        target: user.email,
        ipAddress: ip,
        userAgent: ua,
      });
    }
  } catch {
    // Best effort logging
  }

  return { error: result.error };
}
