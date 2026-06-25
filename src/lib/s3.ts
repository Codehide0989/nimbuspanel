import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getAwsConfig } from "./env";

export type S3Category = "avatars" | "pem-keys" | "configs" | "backups" | "logs";

export interface S3UploadResult {
  key: string;
  bucket: string;
  region: string;
  size: number;
}

export interface S3FileInfo {
  key: string;
  size: number;
  lastModified: Date;
}

function getClient(): S3Client {
  const config = getAwsConfig();
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function getBucket(): string {
  return getAwsConfig().bucket;
}

export function buildKey(category: S3Category, userId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${category}/${userId}/${Date.now()}-${sanitized}`;
}

export async function uploadToS3(buffer: Buffer, key: string, contentType: string): Promise<S3UploadResult> {
  const client = getClient();
  const bucket = getBucket();
  const config = getAwsConfig();

  if (buffer.length > 5 * 1024 * 1024) {
    return multipartUpload(buffer, key, contentType);
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    })
  );

  return { key, bucket, region: config.region, size: buffer.length };
}

async function multipartUpload(buffer: Buffer, key: string, contentType: string): Promise<S3UploadResult> {
  const client = getClient();
  const bucket = getBucket();
  const config = getAwsConfig();

  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024,
    leavePartsOnError: false,
  });

  await upload.done();
  return { key, bucket, region: config.region, size: buffer.length };
}

export async function deleteFromS3(key: string): Promise<void> {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

export async function listS3Files(prefix: string, maxKeys: number = 200): Promise<S3FileInfo[]> {
  const client = getClient();
  const response = await client.send(
    new ListObjectsV2Command({ Bucket: getBucket(), Prefix: prefix, MaxKeys: maxKeys })
  );
  return (response.Contents ?? []).map((item) => ({
    key: item.Key ?? "",
    size: item.Size ?? 0,
    lastModified: item.LastModified ?? new Date(),
  }));
}

export async function renameFile(oldKey: string, newKey: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();

  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${oldKey}`,
    Key: newKey,
    ServerSideEncryption: "AES256",
  }));

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: oldKey }));
}
