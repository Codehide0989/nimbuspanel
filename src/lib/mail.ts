import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSmtpConfig, getAppConfig } from "./env";

// ─── Transporter (singleton) ────────────────────────────

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const smtp = getSmtpConfig();
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: false, // STARTTLS
    auth: { user: smtp.login, pass: smtp.password },
    pool: true,
    maxConnections: 3,
    tls: { rejectUnauthorized: true },
  });

  return transporter;
}

export async function verifySmtp(): Promise<{ connected: boolean; error?: string }> {
  try {
    const t = getTransporter();
    await t.verify();
    console.log("✓ SMTP Connected");
    console.log("✓ Authentication Successful");
    console.log(`✓ Sender: ${getSmtpConfig().emailFrom}`);
    console.log("✓ TLS Enabled");
    return { connected: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "SMTP verification failed";
    console.error("✗ SMTP Failed:", msg);
    return { connected: false, error: msg };
  }
}

// ─── Email Result ───────────────────────────────────────

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Send Helper ────────────────────────────────────────

async function sendMail(to: string, subject: string, html: string): Promise<EmailResult> {
  const smtp = getSmtpConfig();
  const t = getTransporter();

  console.log(`[Mail] Sending: to=${to}, subject="${subject}", from=${smtp.emailFrom}`);

  try {
    const info = await t.sendMail({
      from: smtp.emailFrom,
      to,
      subject,
      html,
    });

    console.log(`[Mail] ✓ Delivered. MessageID: ${info.messageId}, Response: ${info.response}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Send failed";
    console.error(`[Mail] ✗ Failed: ${msg}`);

    if (msg.includes("auth")) return { success: false, error: "SMTP authentication failed" };
    if (msg.includes("ECONNREFUSED")) return { success: false, error: "SMTP connection refused" };
    if (msg.includes("ETIMEDOUT")) return { success: false, error: "SMTP connection timed out" };
    if (msg.includes("reject")) return { success: false, error: "Recipient rejected by server" };

    return { success: false, error: msg };
  }
}

// ─── Template Helpers ───────────────────────────────────

const BRAND = "#3B82F6";
const BG = "#09090B";
const CARD = "#111114";
const BORDER = "#1E1E24";
const TEXT = "#F4F4F5";
const MUTED = "#A1A1AA";
const DIM = "#52525B";

function wrap(content: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${TEXT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:48px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding-bottom:28px;">
  <table cellpadding="0" cellspacing="0"><tr>
    <td style="width:28px;height:28px;background:linear-gradient(135deg,${BRAND},#06B6D4);border-radius:7px;text-align:center;vertical-align:middle;font-size:12px;color:white;font-weight:bold;">⚡</td>
    <td style="padding-left:10px;font-size:15px;font-weight:700;color:${TEXT};">NimbusPanel</td>
  </tr></table>
</td></tr>
<tr><td style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">${content}</td></tr>
<tr><td style="padding-top:20px;text-align:center;">
  <p style="margin:0;font-size:10px;color:${DIM};">NimbusPanel · Cloud Infrastructure Manager</p>
  <p style="margin:4px 0 0;font-size:10px;color:${DIM};">If you didn't expect this email, you can safely ignore it.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:${BRAND};color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${text}</a>`;
}

// ─── Email Functions ────────────────────────────────────

export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  workspaceName: string;
  role: string;
  tempPassword: string;
  inviteToken: string;
  expiresAt: Date;
}): Promise<EmailResult> {
  const app = getAppConfig();
  const acceptUrl = `${app.appUrl}/accept-invite/${params.inviteToken}`;
  const loginUrl = `${app.appUrl}/login`;
  const expiry = params.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const html = wrap(`<td style="padding:32px;">
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT};">You're invited</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED};line-height:1.6;">
      <strong style="color:${TEXT};">${params.inviterName}</strong> invited you to
      <strong style="color:${TEXT};">${params.workspaceName}</strong> as
      <strong style="color:${BRAND};">${params.role}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};border:1px solid ${BORDER};border-radius:8px;padding:16px;margin-bottom:24px;"><tr><td>
      <p style="margin:0 0 8px;font-size:11px;color:${DIM};text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Login Credentials</p>
      <p style="margin:0 0 4px;font-size:13px;color:${TEXT};"><strong>Email:</strong> ${params.to}</p>
      <p style="margin:0;font-size:13px;color:${TEXT};"><strong>Password:</strong> <code style="background:${CARD};border:1px solid ${BORDER};padding:2px 8px;border-radius:4px;font-family:monospace;color:${BRAND};">${params.tempPassword}</code></p>
    </td></tr></table>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;"><tr><td>${btn("Accept Invitation", acceptUrl)}</td></tr></table>
    <p style="margin:0 0 4px;font-size:12px;color:${DIM};">Or log in: <a href="${loginUrl}" style="color:${BRAND};">${loginUrl}</a></p>
    <p style="margin:16px 0 0;font-size:11px;color:${DIM};">Expires ${expiry}. You'll set a new password on first login.</p>
  </td>`);

  return sendMail(params.to, `${params.inviterName} invited you to ${params.workspaceName}`, html);
}

export async function sendPasswordReset(params: { to: string; resetUrl: string }): Promise<EmailResult> {
  const html = wrap(`<td style="padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${TEXT};">Reset Password</h1>
    <p style="margin:0 0 24px;font-size:14px;color:${MUTED};line-height:1.6;">Click below to set a new password. This link expires in 1 hour.</p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;"><tr><td>${btn("Reset Password", params.resetUrl)}</td></tr></table>
    <p style="margin:0;font-size:11px;color:${DIM};">If you didn't request this, ignore this email.</p>
  </td>`);

  return sendMail(params.to, "Reset your NimbusPanel password", html);
}

export async function sendRoleChanged(params: { to: string; workspaceName: string; newRole: string }): Promise<EmailResult> {
  const app = getAppConfig();
  const html = wrap(`<td style="padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${TEXT};">Role Updated</h1>
    <p style="margin:0 0 20px;font-size:14px;color:${MUTED};line-height:1.6;">Your role in <strong style="color:${TEXT};">${params.workspaceName}</strong> is now <strong style="color:${BRAND};">${params.newRole}</strong>.</p>
    <table cellpadding="0" cellspacing="0"><tr><td>${btn("Open Dashboard", `${app.appUrl}/dashboard`)}</td></tr></table>
  </td>`);

  return sendMail(params.to, `Your role in ${params.workspaceName} was updated`, html);
}

export async function sendTestEmail(to: string): Promise<EmailResult> {
  const html = wrap(`<td style="padding:32px;">
    <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:${TEXT};">Test Email</h1>
    <p style="margin:0;font-size:14px;color:${MUTED};">If you received this, your NimbusPanel email system is working correctly via Brevo SMTP.</p>
  </td>`);

  return sendMail(to, "NimbusPanel — Email Test", html);
}
