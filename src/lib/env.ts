/**
 * Lazy, modular environment validation.
 * Each module validates ONLY what it needs, WHEN it needs it.
 */

export function getAwsConfig() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET_NAME;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(`[AWS] Missing environment variables. Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME`);
  }

  return { region, accessKeyId, secretAccessKey, bucket };
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const login = process.env.SMTP_LOGIN;
  const password = process.env.SMTP_PASSWORD;
  const emailFrom = process.env.EMAIL_FROM;

  if (!host || !login || !password || !emailFrom) {
    throw new Error(`[SMTP] Missing environment variables. Required: SMTP_HOST, SMTP_LOGIN, SMTP_PASSWORD, EMAIL_FROM`);
  }

  return { host, port, login, password, emailFrom };
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(`[Database] Missing DATABASE_URL`);
  return url;
}

export function getAppConfig() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    appSecret: process.env.APP_SECRET ?? "",
    appName: process.env.APP_NAME ?? "NimbusPanel",
  };
}
