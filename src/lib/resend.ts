import { Resend } from "resend";
import { getResendConfig, getAppConfig } from "./env";

function getResend(): Resend {
  const config = getResendConfig();
  return new Resend(config.apiKey);
}

interface InvitationEmailParams {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  inviteToken: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams) {
  const resendConfig = getResendConfig();
  const appConfig = getAppConfig();
  const resend = getResend();
  const acceptUrl = `${appConfig.appUrl}/accept-invite/${params.inviteToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#09090B;font-family:'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#09090B;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#18181B;border-radius:12px;border:1px solid #27272A;overflow:hidden;">
        <tr><td style="padding:32px 32px 24px;">
          <div style="font-size:20px;font-weight:700;color:#F9FAFB;">⚡ NimbusPanel</div>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#F9FAFB;">You've been invited</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#9CA3AF;">
            <strong style="color:#F9FAFB;">${params.inviterName}</strong> invited you to
            <strong style="color:#F9FAFB;">${params.workspaceName}</strong> as <strong style="color:#3B82F6;">${params.role}</strong>.
          </p>
          <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background-color:#3B82F6;color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Accept Invitation</a>
          <p style="margin:24px 0 0;font-size:12px;color:#6B7280;">This invitation expires in 7 days.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await resend.emails.send({
    from: resendConfig.emailFrom,
    to: params.to,
    subject: `${params.inviterName} invited you to ${params.workspaceName} on NimbusPanel`,
    html,
  });
}
