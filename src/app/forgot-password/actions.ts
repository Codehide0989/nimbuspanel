"use server";

import { headers } from "next/headers";
import { createPasswordResetToken } from "@/lib/auth";
import { sendPasswordReset } from "@/lib/mail";
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";

export async function forgotPasswordAction(email: string) {
  const headersList = headers();
  const ip = getClientIp(headersList);

  const rateCheck = checkRateLimit(`reset:${ip}`, RATE_LIMITS.passwordReset);
  if (!rateCheck.allowed) return { success: true };

  const token = await createPasswordResetToken(email);
  if (!token) return { success: true };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const result = await sendPasswordReset({ to: email, resetUrl });
  if (!result.success) {
    console.error("[forgotPassword] Email failed:", result.error);
  }

  return { success: true };
}
