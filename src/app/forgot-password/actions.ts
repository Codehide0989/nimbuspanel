"use server";

import { headers } from "next/headers";
import { createPasswordResetToken } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";

export async function forgotPasswordAction(email: string) {
  const headersList = headers();
  const ip = getClientIp(headersList);

  // Rate limit
  const rateCheck = checkRateLimit(`reset:${ip}`, RATE_LIMITS.passwordReset);
  if (!rateCheck.allowed) {
    // Always return success to prevent enumeration, but don't send email
    return { success: true };
  }

  const token = await createPasswordResetToken(email);

  // Always return success to prevent email enumeration
  if (!token) return { success: true };

  try {
    const apiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    if (apiKey && emailFrom) {
      const resend = new Resend(apiKey);
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      await resend.emails.send({
        from: emailFrom,
        to: email,
        subject: "Reset your NimbusPanel password",
        html: `
          <div style="background:#09090B;padding:40px 20px;font-family:sans-serif;">
            <div style="max-width:480px;margin:0 auto;background:#18181B;border-radius:12px;border:1px solid #27272A;padding:32px;">
              <p style="color:#F9FAFB;font-size:18px;font-weight:700;margin:0 0 16px;">⚡ NimbusPanel</p>
              <p style="color:#A1A1AA;font-size:14px;margin:0 0 20px;">Click below to reset your password. This link expires in 1 hour.</p>
              <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;font-size:14px;">Reset Password</a>
              <p style="color:#52525B;font-size:12px;margin:24px 0 0;">If you didn't request this, ignore this email.</p>
            </div>
          </div>
        `,
      });
    }
  } catch (error) {
    // Never expose email sending errors to client
    console.error("[forgotPassword] Email send failed:", error);
  }

  return { success: true };
}
