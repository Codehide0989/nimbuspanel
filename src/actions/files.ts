"use server";

import { db } from "@/lib/db";
import { uploadToS3, deleteFromS3, getPresignedUrl, buildKey, type S3Category } from "@/lib/s3";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";

const MAX_FILE_SIZES: Record<S3Category, number> = {
  avatars: 5 * 1024 * 1024,
  "pem-keys": 64 * 1024,
  configs: 1 * 1024 * 1024,
  backups: 500 * 1024 * 1024,
  logs: 50 * 1024 * 1024,
};

const ALLOWED_MIMES: Record<S3Category, string[]> = {
  avatars: ["image/jpeg", "image/png", "image/webp"],
  "pem-keys": ["application/x-pem-file", "application/octet-stream", "text/plain"],
  configs: ["application/json", "text/plain", "application/yaml"],
  backups: ["application/gzip", "application/zip", "application/x-tar", "application/octet-stream"],
  logs: ["text/plain", "application/json", "text/csv"],
};

export interface UploadProgress {
  stage: "validating" | "uploading" | "saving" | "complete" | "failed";
  message: string;
  error?: string;
}

export async function uploadFile(formData: FormData): Promise<{ data?: { id: string; key: string; filename: string }; error?: string; stage?: string }> {
  const { getAuthUser } = await import("@/lib/auth");
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required", stage: "validating" };

  const file = formData.get("file") as File | null;
  const category = formData.get("category") as S3Category | null;

  const userId = authUser.id;
  const workspaceId = authUser.workspaceId;

  // Validation stage
  if (!file) {
    return { error: "No file provided", stage: "validating" };
  }
  if (!category) {
    return { error: "Missing required field: category", stage: "validating" };
  }

  const validCategories: S3Category[] = ["avatars", "pem-keys", "configs", "backups", "logs"];
  if (!validCategories.includes(category)) {
    return { error: `Invalid category "${category}". Must be one of: ${validCategories.join(", ")}`, stage: "validating" };
  }

  const maxSize = MAX_FILE_SIZES[category];
  if (file.size > maxSize) {
    return { error: `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum size of ${(maxSize / 1024 / 1024).toFixed(1)}MB for category "${category}"`, stage: "validating" };
  }

  const allowedMimes = ALLOWED_MIMES[category];
  if (!allowedMimes.includes(file.type)) {
    return { error: `File type "${file.type}" not allowed for "${category}". Accepted: ${allowedMimes.join(", ")}`, stage: "validating" };
  }

  // Upload stage
  let key: string;
  try {
    key = buildKey(category, userId, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToS3(buffer, key, file.type);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "S3 upload failed";
    console.error("[uploadFile:s3]", error);
    return { error: `Upload to storage failed: ${msg}`, stage: "uploading" };
  }

  // Database save stage
  try {
    const upload = await db.fileUpload.create({
      data: {
        filename: file.name,
        key,
        bucket: process.env.AWS_S3_BUCKET_NAME ?? "nimbuspanel",
        size: file.size,
        mimeType: file.type,
        category,
        userId,
        workspaceId,
      },
    });

    await logActivity({
      action: "file.uploaded",
      userId,
      workspaceId,
      target: file.name,
      metadata: JSON.parse(JSON.stringify({ category, size: file.size, key })),
    });

    revalidatePath("/storage");
    return { data: { id: upload.id, key: upload.key, filename: upload.filename } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Database save failed";
    console.error("[uploadFile:db]", error);
    return { error: `File uploaded to S3 but database save failed: ${msg}`, stage: "saving" };
  }
}

export async function uploadPemKey(formData: FormData): Promise<{ data?: { key: string }; error?: string }> {
  const { getAuthUser } = await import("@/lib/auth");
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Authentication required" };

  const file = formData.get("file") as File | null;
  if (!file) return { error: "No PEM file provided" };

  const userId = authUser.id;
  const workspaceId = authUser.workspaceId;

  if (file.size > 64 * 1024) {
    return { error: "PEM file too large (max 64KB)" };
  }

  // Validate file extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pem" && ext !== "key") {
    return { error: "Invalid file extension. Only .pem and .key files are allowed." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString("utf-8");

    // Validate PEM content contains a private key
    if (!content.includes("PRIVATE KEY")) {
      return { error: "Invalid PEM file — must contain a PRIVATE KEY block" };
    }

    // Generate UUID-based key to prevent filename attacks
    const safeName = `${Date.now()}-${crypto.randomUUID()}.pem`;
    const key = `pem-keys/${userId}/${safeName}`;

    await uploadToS3(buffer, key, "application/x-pem-file");

    // Save metadata in DB
    await db.fileUpload.create({
      data: {
        filename: file.name,
        key,
        bucket: process.env.AWS_S3_BUCKET_NAME ?? "nimbuspanel",
        size: file.size,
        mimeType: "application/x-pem-file",
        category: "pem-keys",
        userId,
        workspaceId,
      },
    });

    return { data: { key } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "PEM upload failed";
    console.error("[uploadPemKey]", error);
    return { error: msg };
  }
}

export async function deleteFileRecord(fileId: string, userId?: string) {
  try {
    const file = await db.fileUpload.findUnique({ where: { id: fileId } });
    if (!file) return { error: "File not found" };

    await deleteFromS3(file.key);
    await db.fileUpload.delete({ where: { id: fileId } });

    await logActivity({
      action: "file.deleted",
      userId,
      workspaceId: file.workspaceId,
      target: file.filename,
    });

    revalidatePath("/storage");
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Delete failed";
    console.error("[deleteFile]", error);
    return { error: msg };
  }
}

export async function getDownloadUrl(fileId: string) {
  try {
    const file = await db.fileUpload.findUnique({ where: { id: fileId } });
    if (!file) return { error: "File not found" };

    const url = await getPresignedUrl(file.key, 3600);
    return { data: { url } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate download URL";
    console.error("[getDownloadUrl]", error);
    return { error: msg };
  }
}
