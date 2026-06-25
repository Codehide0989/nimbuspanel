import { Resend } from "resend";
import { getResendConfig, getAppConfig } from "./env";

function getResend(): Resend {
  const config = getResendConfig();
  return new Resend(config.apiKey);
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

interface InvitationEmailParams {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  inviteToken: string;
  tempPassword: string;
  expiresAt: Date;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<EmailResult> {
  try {
    const resendConfig = getResendConfig();
    const appConfig = getAppConfig();
    const resend = getResend();
    const loginUrl = `${appConfig.appUrl}/login`;
    const acceptUrl = `${appConfig.appUrl}/accept-invite/${params.inviteToken}`;
    const expiryDate = params.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const { data, error } = await resend.emails.send({
      from: resendConfig.emailFrom,
      to: params.to,
      subject: `${params.inviterName} invited you to ${params.workspaceName}`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#09090B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090B;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#18181B;border-radius:12px;border:1px solid #27272A;overflow:hidden;">
        <tr><td style="padding:32px 32px 16px;">
          <div style="font-size:18px;font-weight:700;color:#F9FAFB;">⚡ NimbusPanel</div>
          <div style="font-size:11px;color:#6B7280;margin-top:2px;">Cloud Infrastructure Manager</div>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#F9FAFB;">You're invited</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#A1A1AA;">
            <strong style="color:#F9FAFB;">${params.inviterName}</strong> invited you to join
            <strong style="color:#F9FAFB;">${params.workspaceName}</strong> as <strong style="color:#3B82F6;">${params.role}</strong>.
          </p>

          <div style="background:#111114;border:1px solid #27272A;border-radius:8px;padding:16px;margin-bottom:20px;">
            <p style="margin:0 0 8px;font-size:12px;color:#6B7280;">Your temporary login credentials:</p>
            <p style="margin:0 0 4px;font-size:13px;color:#F9FAFB;"><strong>Email:</strong> ${params.to}</p>
            <p style="margin:0;font-size:13px;color:#F9FAFB;"><strong>Password:</strong> <code style="background:#09090B;padding:2px 6px;border-radius:4px;font-family:monospace;">${params.tempPassword}</code></p>
          </div>

          <a href="${acceptUrl}" style="display:inline-block;padding:12px 28px;background-color:#3B82F6;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;margin-bottom:12px;">Accept Invitation</a>

          <p style="margin:16px 0 0;font-size:12px;color:#6B7280;">
            Or log in directly at: <a href="${loginUrl}" style="color:#3B82F6;">${loginUrl}</a>
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#52525B;">
            This invitation expires on ${expiryDate}. You'll be asked to set a new password on first login.
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #27272A;">
          <p style="margin:0;font-size:10px;color:#52525B;">NimbusPanel · Enterprise Cloud Infrastructure</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (error) {
      console.error("[Resend] Email delivery failed:", error);
      return { success: false, error: `Email delivery failed: ${error.message}` };
    }

    console.log("[Resend] Email sent successfully:", data?.id);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown email error";
    console.error("[Resend] Exception:", msg);
    return { success: false, error: msg };
  }
}

export async function sendRoleChangedEmail(params: { to: string; workspaceName: string; newRole: string }): Promise<EmailResult> {
  try {
    const resendConfig = getResendConfig();
    const resend = getResend();
    const appConfig = getAppConfig();

    const { error } = await resend.emails.send({
      from: resendConfig.emailFrom,
      to: params.to,
      subject: `Your role in ${params.workspaceName} has been updated`,
      html: `
<body style="margin:0;padding:0;background-color:#09090B;font-family:-apple-system,sans-serif;">
  <table width="100%" style="background:#09090B;padding:40px 20px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#18181B;border-radius:12px;border:1px solid #27272A;padding:32px;">
      <tr><td>
        <p style="font-size:18px;font-weight:700;color:#F9FAFB;margin:0 0 16px;">⚡ NimbusPanel</p>
        <h1 style="font-size:18px;color:#F9FAFB;margin:0 0 12px;">Role Updated</h1>
        <p style="font-size:14px;color:#A1A1AA;margin:0 0 16px;">Your role in <strong style="color:#F9FAFB;">${params.workspaceName}</strong> has been changed to <strong style="color:#3B82F6;">${params.newRole}</strong>.</p>
        <a href="${appConfig.appUrl}/dashboard" style="display:inline-block;padding:10px 20px;background:#3B82F6;color:white;text-decoration:none;border-radius:8px;font-size:13px;">Open Dashboard</a>
      </td></tr>
    </table>
  </td></tr></table>
</body>`,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Email failed" };
  }
}
