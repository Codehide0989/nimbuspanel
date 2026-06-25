"use server";

import { changePassword, getAuthUser } from "@/lib/auth";

export async function changePasswordAction(newPassword: string) {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  return changePassword(user.id, newPassword);
}
