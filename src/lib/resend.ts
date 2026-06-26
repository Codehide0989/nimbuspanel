import { Resend } from "resend";
import { getResendConfig, getAppConfig } from "./env";

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getResend(): Resend {
  const config = getResendConfig();
  return new Resend(config.apiKey);
}

function validateSender(): string {
  const config = getResendConfig();
  const from = config.emailFrom;

  // Validate sender belongs to verified domain
  if (!from.includes("adda67.app")) {
    throw new Error(`EMAIL_FROM must use the verified domain adda67.app. Got: ${from}`);
  }

  return from;
}

// ─── Shared Template Components ─────────────────────────────────

const BRAND_COLOR = "#3B82F6";
const BG_COLOR = "#09090B";
const CARD_COLOR = "#111114";
const BORDER_COLOR = "#1E1E24";
const TEXT_COLOR = "#F4F4F5";
const MUTED_COLOR = "#A1A1AA";
const DIM_COLOR = "#52525B";

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${TEXT_COLOR};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;height:28px;background:linear-gradient(135deg,${BRAND_COLOR},#06B6D4);border-radius:7px;text-align:center;vertical-align:middle;font-size:12px;color:white;font-weight:bold;">⚡</td>
            <td style="padding-left:10px;font-size:15px;font-weight:700;color:${TEXT_COLOR};letter-spacing:-0.01em;">NimbusPanel</td>
          </tr></table>
        </td></tr>
        <!-- Content Card -->
        <tr><td style="background-color:${CARD_COLOR};border:1px solid ${BORDER_COLOR};border-radius:12px;overflow:hidden;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:${DIM_COLOR};line-height:1.5;">NimbusPanel · Cloud Infrastructure Manager</p>
          <p style="margin:4px 0 0;font-size:10px;color:${DIM_COLOR};">If you were not expecting this email, you can safely ignore it.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 28px;background-color:${BRAND_COLOR};color:#FFFFFF;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:-0.01em;">${text}</a>`;
}

function roleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    Owner: "Full access to all servers, team management, settings, and billing.",
    Admin: "Manage servers, team members, storage, and settings.",
    Operator: "Start, stop, and reboot servers. View monitoring data.",
    "SSH User": "Access the SSH console for assigned servers.",
    "Read Only": "View server status, monitoring dashboards, and storage.",
  };
  return descriptions[role] ?? "Access to assigned resources.";
}

// ─── Email Templates ────────────────────────────────────────────

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
    const from = validateSender();
    const resend = getResend();
    const appConfig = getAppConfig();
    const acceptUrl = `${appConfig.appUrl}/accept-invite/${params.inviteToken}`;
    const loginUrl = `${appConfig.appUrl}/login`;
    const expiryDate = params.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const content = `
      <td style="padding:32px;">
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_COLOR};letter-spacing:-0.02em;">You're invited</h1>
        <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};line-height:1.6;">
          <strong style="color:${TEXT_COLOR};">${params.inviterName}</strong> invited you to join
          <strong style="color:${TEXT_COLOR};">${params.workspaceName}</strong>.
        </p>

        <!-- Role Badge -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
          <td style="background-color:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:8px;padding:12px 16px;">
            <p style="margin:0 0 4px;font-size:12px;color:${MUTED_COLOR};">Your role</p>
            <p style="margin:0;font-size:16px;font-weight:600;color:${BRAND_COLOR};">${params.role}</p>
            <p style="margin:6px 0 0;font-size:11px;color:${DIM_COLOR};">${roleDescription(params.role)}</p>
          </td>
        </tr></table>

        <!-- Credentials -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};border:1px solid ${BORDER_COLOR};border-radius:8px;padding:16px;margin-bottom:24px;">
          <tr><td>
            <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:${DIM_COLOR};text-transform:uppercase;letter-spacing:0.05em;">Login Credentials</p>
            <p style="margin:0 0 4px;font-size:13px;color:${TEXT_COLOR};"><strong>Email:</strong> ${params.to}</p>
            <p style="margin:0;font-size:13px;color:${TEXT_COLOR};"><strong>Password:</strong> <code style="background:${CARD_COLOR};border:1px solid ${BORDER_COLOR};padding:2px 8px;border-radius:4px;font-family:monospace;font-size:13px;color:${BRAND_COLOR};">${params.tempPassword}</code></p>
          </td></tr>
        </table>

        <!-- CTA Button -->
        <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td>
          ${button("Accept Invitation", acceptUrl)}
        </td></tr></table>

        <p style="margin:0 0 4px;font-size:12px;color:${DIM_COLOR};">
          Or log in at: <a href="${loginUrl}" style="color:${BRAND_COLOR};text-decoration:none;">${loginUrl}</a>
        </p>

        <!-- Notices -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid ${BORDER_COLOR};padding-top:16px;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:11px;color:${DIM_COLOR};">⏱ This invitation expires on ${expiryDate}.</p>
            <p style="margin:0;font-size:11px;color:${DIM_COLOR};">🔒 You'll be asked to set a new password on first login.</p>
          </td></tr>
        </table>
      </td>`;

    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: `${params.inviterName} invited you to ${params.workspaceName}`,
      html: emailWrapper(content),
    });

    if (error) {
      console.error("[Resend] Delivery failed:", JSON.stringify(error));
      return { success: false, error: error.message };
    }

    console.log("[Resend] Sent invitation:", data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Email send failed";
    console.error("[Resend] Exception:", msg);

    // Retry once for transient errors
    if (msg.includes("rate") || msg.includes("timeout") || msg.includes("5")) {
      console.log("[Resend] Retrying...");
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const from = validateSender();
        const resend = getResend();
        const appConfig = getAppConfig();
        const { data, error: retryError } = await resend.emails.send({
          from,
          to: params.to,
          subject: `${params.inviterName} invited you to ${params.workspaceName}`,
          html: emailWrapper(`<td style="padding:32px;"><p style="color:${TEXT_COLOR};">You've been invited to ${params.workspaceName}. Check your original invitation or contact your admin.</p></td>`),
        });
        if (retryError) return { success: false, error: `Retry failed: ${retryError.message}` };
        return { success: true, messageId: data?.id };
      } catch (retryErr) {
        return { success: false, error: `Retry failed: ${retryErr instanceof Error ? retryErr.message : "Unknown"}` };
      }
    }

    return { success: false, error: msg };
  }
}

export async function sendRoleChangedEmail(params: { to: string; workspaceName: string; newRole: string }): Promise<EmailResult> {
  try {
    const from = validateSender();
    const resend = getResend();
    const appConfig = getAppConfig();

    const content = `
      <td style="padding:32px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${TEXT_COLOR};">Role Updated</h1>
        <p style="margin:0 0 20px;font-size:14px;color:${MUTED_COLOR};line-height:1.6;">
          Your role in <strong style="color:${TEXT_COLOR};">${params.workspaceName}</strong> has been changed to
          <strong style="color:${BRAND_COLOR};">${params.newRole}</strong>.
        </p>
        <p style="margin:0 0 4px;font-size:12px;color:${DIM_COLOR};">${roleDescription(params.newRole)}</p>
        <table cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td>
          ${button("Open Dashboard", `${appConfig.appUrl}/dashboard`)}
        </td></tr></table>
      </td>`;

    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: `Your role in ${params.workspaceName} has been updated`,
      html: emailWrapper(content),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed" };
  }
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }): Promise<EmailResult> {
  try {
    const from = validateSender();
    const resend = getResend();

    const content = `
      <td style="padding:32px;">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${TEXT_COLOR};">Reset Password</h1>
        <p style="margin:0 0 24px;font-size:14px;color:${MUTED_COLOR};line-height:1.6;">
          Click the button below to reset your password. This link expires in 1 hour.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td>
          ${button("Reset Password", params.resetUrl)}
        </td></tr></table>
        <p style="margin:0;font-size:11px;color:${DIM_COLOR};">If you didn't request this, ignore this email. Your password won't change.</p>
      </td>`;

    const { data, error } = await resend.emails.send({
      from,
      to: params.to,
      subject: "Reset your NimbusPanel password",
      html: emailWrapper(content),
    });

    if (error) return { success: false, error: error.message };
    return { success: true, messageId: data?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed" };
  }
}
