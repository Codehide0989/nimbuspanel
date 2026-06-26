/**
 * Lazy, modular environment validation.
 * Each module validates ONLY what it needs, WHEN it needs it.
 * Never blocks one feature because another feature's vars are missing.
 */

export function getAwsConfig() {
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.AWS_S3_BUCKET_NAME;

  if (!region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      `[AWS] Missing environment variables. Required: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME`
    );
  }

  return { region, accessKeyId, secretAccessKey, bucket };
}

export function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!apiKey || !emailFrom) {
    throw new Error(
      `[Resend] Missing environment variables. Required: RESEND_API_KEY, EMAIL_FROM`
    );
  }

  if (!emailFrom.includes("adda67.app")) {
    throw new Error(
      `[Resend] EMAIL_FROM must use the verified domain adda67.app. Got: "${emailFrom}"`
    );
  }

  return { apiKey, emailFrom };
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(`[Database] Missing DATABASE_URL environment variable`);
  }
  return url;
}

export function getAppConfig() {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    appSecret: process.env.APP_SECRET ?? "",
  };
}
