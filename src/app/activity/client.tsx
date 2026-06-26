"use client";

import { Activity, Server, Users, FolderOpen, Terminal, Shield } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime, formatDate, cn } from "@/lib/utils";
import { useState } from "react";

interface LogEntry { id: string; action: string; target: string | null; ipAddress: string | null; createdAt: string; userEmail: string | null; }
interface Props { logs: LogEntry[]; }

function getActionConfig(action: string) {
  if (action.includes("start")) return { icon: Server, color: "text-success", bg: "bg-success/10 border-success/20" };
  if (action.includes("stop")) return { icon: Server, color: "text-danger", bg: "bg-danger/10 border-danger/20" };
  if (action.includes("reboot") || action.includes("terminat")) return { icon: Server, color: "text-warning", bg: "bg-warning/10 border-warning/20" };
  if (action.startsWith("vps.")) return { icon: Server, color: "text-primary", bg: "bg-primary/10 border-primary/20" };
  if (action.startsWith("user.") || action.startsWith("invitation.")) return { icon: Users, color: "text-purple", bg: "bg-purple/10 border-purple/20" };
  if (action.startsWith("file.")) return { icon: FolderOpen, color: "text-warning", bg: "bg-warning/10 border-warning/20" };
  if (action.startsWith("ssh.")) return { icon: Terminal, color: "text-primary", bg: "bg-primary/10 border-primary/20" };
  return { icon: Shield, color: "text-muted", bg: "bg-card border-border" };
}

function formatAction(action: string): string {
  return action.replace(/\./g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function ActivityClient({ logs }: Props) {
  const [filter, setFilter] = useState("all");

  const filtered = logs.filter((l) => {
    if (filter === "all") return true;
    return l.action.startsWith(filter);
  });

  return (
    <AppShell title="Activity" subtitle="Audit trail of workspace events">
      <div className="space-y-4 animate-fade-in">
        {/* Filters */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
          {[
            { id: "all", label: "All" },
            { id: "vps", label: "Servers" },
            { id: "user", label: "Users" },
            { id: "file", label: "Files" },
          ].map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                filter === f.id ? "bg-primary/10 text-primary" : "text-muted hover:text-secondary")}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState icon={Activity} title="No activity yet" description="Events will appear here as actions are performed in this workspace." compact />
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((log) => {
                const config = getActionConfig(log.action);
                const Icon = config.icon;
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-card-hover/40 transition-colors">
                    <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border mt-0.5", config.bg)}>
                      <Icon size={12} className={config.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] text-foreground font-medium">{formatAction(log.action)}</p>
                        {log.target && <span className="font-mono text-[10px] text-muted bg-bg px-1.5 py-0.5 rounded border border-border">{log.target}</span>}
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">
                        {log.userEmail ?? "System"}
                        {log.ipAddress && <span> · {log.ipAddress}</span>}
                        <span> · {formatRelativeTime(log.createdAt)}</span>
                      </p>
                    </div>
                    <span className="text-[9px] text-muted shrink-0 hidden sm:block">{formatDate(log.createdAt).split(",")[0]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
