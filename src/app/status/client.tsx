"use client";

import { CheckCircle, XCircle, Database, Cloud, Mail, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import type { StartupStatus } from "@/lib/startup-check";
import { cn } from "@/lib/utils";

interface Props {
  status: StartupStatus;
}

function ServiceCard({ name, connected, error, icon: Icon }: {
  name: string;
  connected: boolean;
  error?: string;
  icon: typeof Database;
}) {
  return (
    <div className={cn(
      "border rounded-xl p-5 transition-all",
      connected ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"
    )}>
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center",
          connected ? "bg-success/10" : "bg-danger/10"
        )}>
          <Icon size={18} className={connected ? "text-success" : "text-danger"} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">{name}</h3>
            {connected ? (
              <CheckCircle size={14} className="text-success" />
            ) : (
              <XCircle size={14} className="text-danger" />
            )}
          </div>
          <p className="text-[11px] text-secondary">
            {connected ? "Connected" : "Failed"}
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-2 p-2.5 rounded-lg bg-bg border border-border">
          <p className="text-[10px] font-mono text-danger break-all">{error}</p>
        </div>
      )}
    </div>
  );
}

export function StatusClient({ status }: Props) {
  const router = useRouter();
  const allConnected = status.database.connected && status.s3.connected && status.smtp.connected;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="text-2xl mb-2">⚡</div>
          <h1 className="text-[17px] font-bold text-foreground">NimbusPanel Status</h1>
          <p className="text-[12px] text-secondary mt-1">Service health check</p>
        </div>

        {/* Overall Status */}
        <div className={cn(
          "text-center p-4 rounded-xl border",
          allConnected ? "bg-success/5 border-success/20" : "bg-warning/5 border-warning/20"
        )}>
          <p className={cn("text-[13px] font-semibold", allConnected ? "text-success" : "text-warning")}>
            {allConnected ? "All Systems Operational" : "Some Services Unavailable"}
          </p>
        </div>

        {/* Services */}
        <div className="space-y-3">
          <ServiceCard
            name="PostgreSQL Database"
            connected={status.database.connected}
            error={status.database.error}
            icon={Database}
          />
          <ServiceCard
            name="AWS S3 Storage"
            connected={status.s3.connected}
            error={status.s3.error}
            icon={Cloud}
          />
          <ServiceCard
            name="SMTP (Brevo)"
            connected={status.smtp.connected}
            error={status.smtp.error}
            icon={Mail}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.refresh()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-card border border-border text-foreground hover:bg-card-hover transition-all"
          >
            <RefreshCw size={13} /> Recheck
          </button>
          {allConnected && (
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-primary text-white hover:bg-primary-hover transition-all"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
