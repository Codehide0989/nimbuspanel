import { db } from "@/lib/db";
import { StorageClient } from "./client";

export const dynamic = "force-dynamic";

export default async function StoragePage() {
  let files: Array<{
    id: string;
    filename: string;
    category: string;
    size: number;
    mimeType: string;
    createdAt: string;
    uploaderEmail: string;
  }> = [];

  try {
    const uploads = await db.fileUpload.findMany({
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    files = uploads.map((f) => ({
      id: f.id,
      filename: f.filename,
      category: f.category,
      size: f.size,
      mimeType: f.mimeType,
      createdAt: f.createdAt.toISOString(),
      uploaderEmail: f.user.email,
    }));
  } catch (error) {
    console.error("[StoragePage] DB error:", error);
  }

  return <StorageClient files={files} />;
}
