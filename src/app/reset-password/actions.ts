"use server";

import { resetPasswordWithToken } from "@/lib/auth";

export async function resetPasswordAction(token: string, newPassword: string) {
  return resetPasswordWithToken(token, newPassword);
}
