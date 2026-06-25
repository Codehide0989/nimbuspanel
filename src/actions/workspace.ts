"use server";

import { db } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { createWorkspaceSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";

export async function createWorkspace(input: unknown, userId: string) {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name } = parsed.data;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    const existing = await db.workspace.findUnique({ where: { slug } });
    if (existing) {
      return { error: "A workspace with this name already exists" };
    }

    const workspace = await db.workspace.create({
      data: {
        name,
        slug,
        teamMembers: {
          create: {
            userId,
            role: "OWNER",
          },
        },
      },
    });

    await logActivity({
      action: "workspace.created",
      userId,
      workspaceId: workspace.id,
      target: workspace.name,
    });

    revalidatePath("/");
    return { data: workspace };
  } catch (error) {
    console.error("[createWorkspace]", error);
    return { error: "Failed to create workspace" };
  }
}

export async function getWorkspaces(userId: string) {
  try {
    const memberships = await db.teamMember.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { joinedAt: "desc" },
    });
    return { data: memberships };
  } catch (error) {
    console.error("[getWorkspaces]", error);
    return { error: "Failed to load workspaces" };
  }
}
