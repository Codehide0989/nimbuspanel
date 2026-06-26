"use client";

import { Plus, Cpu, HardDrive, MemoryStick, Rocket, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime, cn } from "@/lib/utils";
import Link from "next/link";
import type { NavItem } from "@/lib/navigation";

interface ServerData {
  id: string;
  displayName: string;
  publicIp: string;
  status: string;
  provider: string;
  os: string;
  osName: string | null;
  osVersion: string | null;
  hostname: string | null;
  username: string;
  sshPort: number;
  cpuCores: number | null;
  ramTotalMb: number | null;
  diskTotalGb: number | null;
  diskUsedGb: number | null;
  diskFreeGb: number | null;
  arch: string | null;
  kernel: string | null;
  uptime: string | null;
  environment: string;
  lastSeenAt: string | null;
  createdAt: string;
}

interface Props {
  servers: ServerData[];
  nav: NavItem[];
  user: { name: string | null; email: string; workspaceName: string };
}

function ServerCard({ server }: { server: ServerData }) {
  const isOnline = server.status === "online";
  const diskPercent = server.diskTotalGb && server.diskUsedGb
    ? Math.round((server.diskUsedGb / server.diskTotalGb) * 100)
    : null;

  return (
    <Link href={`/servers/${server.id}`} className="block group">
      <div className="gradient-border rounded-xl p-4 hover:scale-[1.01] transition-all duration-200 bg-card border border-border">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />}
              <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isOnline ? "bg-success" : "bg-danger")} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors">{server.displayName}</p>
              <p className="text-[10px] text-muted">{server.hostname ?? server.publicIp}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-card-hover text-secondary border border-border capitalize">{server.provider}</span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize">{server.os}</span>
          </div>
        </div>

        {/* Connection Info */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3 text-[10px]">
          <div className="flex justify-between"><span className="text-muted">IP</span><span className="text-foreground font-mono">{server.publicIp}</span></div>
          <div className="flex justify-between"><span className="text-muted">Port</span><span className="text-foreground font-mono">{server.sshPort}</span></div>
          <div className="flex justify-between"><span className="text-muted">User</span><span className="text-foreground">{server.username}</span></div>
          <div className="flex justify-between"><span className="text-muted">Arch</span><span className="text-foreground">{server.arch ?? "—"}</span></div>
        </div>

        {/* Resource Grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-bg rounded-lg p-2 text-center border border-border/50">
            <Cpu size={11} className="mx-auto text-primary mb-0.5" />
            <p className="text-[11px] font-bold text-foreground">{server.cpuCores ?? "—"}</p>
            <p className="text-[8px] text-muted">CPU</p>
          </div>
          <div className="bg-bg rounded-lg p-2 text-center border border-border/50">
            <MemoryStick size={11} className="mx-auto text-success mb-0.5" />
            <p className="text-[11px] font-bold text-foreground">{server.ramTotalMb ? `${Math.round(server.ramTotalMb / 1024)}G` : "—"}</p>
            <p className="text-[8px] text-muted">RAM</p>
          </div>
          <div className="bg-bg rounded-lg p-2 text-center border border-border/50">
            <HardDrive size={11} className="mx-auto text-warning mb-0.5" />
            <p className="text-[11px] font-bold text-foreground">{server.diskTotalGb ? `${Math.round(server.diskTotalGb)}G` : "—"}</p>
            <p className="text-[8px] text-muted">Disk</p>
          </div>
        </div>

        {/* Disk usage bar */}
        {diskPercent !== null && (
          <div className="mb-3">
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-muted">Disk Usage</span>
              <span className={cn("font-medium", diskPercent > 80 ? "text-danger" : diskPercent > 60 ? "text-warning" : "text-success")}>{diskPercent}%</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", diskPercent > 80 ? "bg-danger" : diskPercent > 60 ? "bg-warning" : "bg-success")}
                style={{ width: `${diskPercent}%` }} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[9px] text-muted pt-2 border-t border-border/50">
          <div className="flex items-center gap-1">
            <Clock size={9} />
            <span>{server.uptime ?? "Unknown uptime"}</span>
          </div>
          <span>{server.lastSeenAt ? formatRelativeTime(server.lastSeenAt) : "Never synced"}</span>
        </div>
      </div>
    </Link>
  );
}

export function DashboardClient({ servers, nav, user }: Props) {
  const online = servers.filter((s) => s.status === "online").length;
  const offline = servers.filter((s) => s.status !== "online").length;

  return (
    <AppShell title="Dashboard" subtitle={`${servers.length} server${servers.length !== 1 ? "s" : ""} managed`} nav={nav} user={user}>
      {servers.length === 0 ? (
        <div className="animate-fade-in">
          <EmptyState
            icon={Rocket}
            title="Add Your First Server"
            description="Connect a VPS via SSH to start managing your infrastructure. NimbusPanel will automatically collect system information."
            primaryAction={
              <Link href="/servers/new" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                <Plus size={14} /> Add Server
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-5 animate-fade-in">
          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-secondary font-medium">{online} online</span>
            </div>
            {offline > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-danger" />
                <span className="text-secondary font-medium">{offline} offline</span>
              </div>
            )}
            <div className="ml-auto">
              <Link href="/servers/new" className="flex items-center gap-1 text-primary hover:text-primary-hover font-medium transition-colors">
                <Plus size={11} /> Add Server
              </Link>
            </div>
          </div>

          {/* Server Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {servers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
