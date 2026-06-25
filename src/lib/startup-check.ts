import { isDatabaseHealthy } from "./db";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";
import { EC2Client, DescribeRegionsCommand } from "@aws-sdk/client-ec2";
import { Resend } from "resend";

export interface ServiceStatus {
  connected: boolean;
  latencyMs: number;
  error?: string;
}

export interface StartupStatus {
  database: ServiceStatus;
  s3: ServiceStatus;
  resend: ServiceStatus;
  aws: ServiceStatus;
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
}

export async function runStartupChecks(): Promise<StartupStatus> {
  const status: StartupStatus = {
    database: { connected: false, latencyMs: 0 },
    s3: { connected: false, latencyMs: 0 },
    resend: { connected: false, latencyMs: 0 },
    aws: { connected: false, latencyMs: 0 },
    overall: "unhealthy",
    timestamp: new Date().toISOString(),
  };

  // Database check
  const dbResult = await isDatabaseHealthy();
  status.database = { connected: dbResult.healthy, latencyMs: dbResult.latencyMs, error: dbResult.error };

  // S3 check
  const s3Start = Date.now();
  try {
    const region = process.env.AWS_REGION;
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!region || !bucket || !accessKeyId || !secretAccessKey) throw new Error("AWS S3 env vars missing");
    const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    status.s3 = { connected: true, latencyMs: Date.now() - s3Start };
  } catch (error) {
    status.s3 = { connected: false, latencyMs: Date.now() - s3Start, error: error instanceof Error ? error.message : "S3 error" };
  }

  // Resend check
  const resendStart = Date.now();
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not set");
    const resend = new Resend(apiKey);
    await resend.domains.list();
    status.resend = { connected: true, latencyMs: Date.now() - resendStart };
  } catch (error) {
    status.resend = { connected: false, latencyMs: Date.now() - resendStart, error: error instanceof Error ? error.message : "Resend error" };
  }

  // AWS EC2 check
  const awsStart = Date.now();
  try {
    const region = process.env.AWS_REGION;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!region || !accessKeyId || !secretAccessKey) throw new Error("AWS env vars missing");
    const client = new EC2Client({ region, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new DescribeRegionsCommand({}));
    status.aws = { connected: true, latencyMs: Date.now() - awsStart };
  } catch (error) {
    status.aws = { connected: false, latencyMs: Date.now() - awsStart, error: error instanceof Error ? error.message : "AWS error" };
  }

  // Overall status
  const services = [status.database, status.s3, status.resend, status.aws];
  const connectedCount = services.filter((s) => s.connected).length;
  status.overall = connectedCount === services.length ? "healthy" : connectedCount > 0 ? "degraded" : "unhealthy";

  return status;
}
