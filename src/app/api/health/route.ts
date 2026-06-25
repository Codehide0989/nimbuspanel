import { NextResponse } from "next/server";
import { isDatabaseHealthy } from "@/lib/db";
import { S3Client, HeadBucketCommand } from "@aws-sdk/client-s3";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Database
  const dbHealth = await isDatabaseHealthy();
  checks.database = { status: dbHealth.healthy ? "healthy" : "unhealthy", latencyMs: dbHealth.latencyMs, error: dbHealth.error };

  // S3
  const s3Start = Date.now();
  try {
    const region = process.env.AWS_REGION;
    const bucket = process.env.AWS_S3_BUCKET_NAME;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!region || !bucket || !accessKeyId || !secretAccessKey) throw new Error("Missing AWS env");
    const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    checks.s3 = { status: "healthy", latencyMs: Date.now() - s3Start };
  } catch (error) {
    checks.s3 = { status: "unhealthy", latencyMs: Date.now() - s3Start, error: error instanceof Error ? error.message : "S3 error" };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
  return NextResponse.json(
    { status: allHealthy ? "healthy" : "degraded", timestamp: new Date().toISOString(), checks },
    { status: allHealthy ? 200 : 503 }
  );
}
