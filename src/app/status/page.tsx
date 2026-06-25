import { runStartupChecks } from "@/lib/startup-check";
import { StatusClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StatusPage() {
  const status = await runStartupChecks();
  return <StatusClient status={status} />;
}
