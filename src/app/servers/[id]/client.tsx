"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Trash2, Copy, Loader2, Cpu, HardDrive, MemoryStick, Globe, Clock, Terminal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/components/ui/toast";
import { refreshServerInfo, deleteServer } from "@/actions/vps";
import { formatDate, cn } from "@/lib/utils";
import Link from "next/link";
import type { NavItem } from "@/lib/navigation";

interface ServerDetail {
  id: string;
  displayName: string;
  publicIp: string;
  sshPort: number;
  username: string;
  status: string;
  provider: string;
  os: string;
  environment: string;
  notes: string | null;
  hostname: string | null;
  kernel: string | null;
  arch: string | null;
  cpuCores: number | null;
  ramTotalMb: number | null;
  diskTotalGb: number | null;
  diskUsedGb: number | null;
  diskFreeGb: number | null;
  filesystem: string | null;
  privateIp: string | null;
  osName: string | null;
  osVersion: string | null;
  uptime: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

interface Props {
  server: ServerDetail;
  nav?: NavItem[];
  user?: { name: string | null; email: string; workspaceName: string };
}

export function ServerDetailClient({ server, nav, user }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isOnline = server.status === "online";
  const diskPercent = server.diskTotalGb && server.diskUsedGb ? Math.round((server.diskUsedGb / server.diskTotalGb) * 100) : null;

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast("Copied", "success"); };

  const handleRefresh = async () => {
    setLoading(true);
    const result = await refreshServerInfo(server.id);
    setLoading(false);
    if (result.error) toast(result.error, "error");
    else { toast("Server info refreshed", "success"); router.refresh(); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${server.displayName}"? This cannot be undone.`)) return;
    const result = await deleteServer(server.id);
    if (result.error) toast(result.error, "error");
    else { toast("Server deleted", "success"); router.push("/servers"); }
  };

  return (
    <AppShell title={server.displayName} subtitle={server.hostname ?? server.publicIp} nav={nav} user={user}>
      <div className="max-w-4xl space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/servers" className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all">
              <ArrowLeft size={15} />
            </Link>
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />}
                <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", isOnline ? "bg-success" : "bg-danger")} />
              </span>
              <div>
                <h1 className="text-[15px] font-semibold text-foreground">{server.displayName}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-card-hover border border-border text-secondary capitalize">{server.provider}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary capitalize">{server.os}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/10 border border-warning/20 text-warning capitalize">{server.environment}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium bg-card border border-border text-foreground hover:bg-card-hover disabled:opacity-50 transition-all">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-all">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>

        {/* Resource Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Cpu size={14} className="mx-auto text-primary mb-1" />
            <p className="text-[15px] font-bold text-foreground">{server.cpuCores ?? "—"}</p>
            <p className="text-[9px] text-muted">CPU Cores</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <MemoryStick size={14} className="mx-auto text-success mb-1" />
            <p className="text-[15px] font-bold text-foreground">{server.ramTotalMb ? `${(server.ramTotalMb / 1024).toFixed(1)}` : "—"} <span className="text-[10px] text-muted">GB</span></p>
            <p className="text-[9px] text-muted">RAM</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <HardDrive size={14} className="mx-auto text-warning mb-1" />
            <p className="text-[15px] font-bold text-foreground">{server.diskTotalGb ? `${Math.round(server.diskTotalGb)}` : "—"} <span className="text-[10px] text-muted">GB</span></p>
            <p className="text-[9px] text-muted">Disk Total</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <Clock size={14} className="mx-auto text-purple mb-1" />
            <p className="text-[11px] font-medium text-foreground truncate">{server.uptime ?? "—"}</p>
            <p className="text-[9px] text-muted">Uptime</p>
          </div>
        </div>

        {/* Disk Usage */}
        {diskPercent !== null && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between text-[11px] mb-2">
              <span className="text-muted">Disk Usage</span>
              <span className="text-foreground font-medium">{server.diskUsedGb?.toFixed(1)}G / {server.diskTotalGb?.toFixed(1)}G ({diskPercent}%)</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full", diskPercent > 80 ? "bg-danger" : diskPercent > 60 ? "bg-warning" : "bg-success")} style={{ width: `${diskPercent}%` }} />
            </div>
            {server.diskFreeGb && <p className="text-[10px] text-muted mt-1">{server.diskFreeGb.toFixed(1)} GB free · {server.filesystem ?? "Unknown filesystem"}</p>}
          </div>
        )}

        {/* Detail Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Network */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Globe size={13} className="text-primary" />
              <h2 className="text-[12px] font-semibold text-foreground">Network</h2>
            </div>
            <div className="divide-y divide-border/30 text-[11px]">
              {[
                { label: "Public IP", value: server.publicIp, copyable: true, mono: true },
                { label: "Private IP", value: server.privateIp ?? "—", mono: true },
                { label: "SSH Port", value: String(server.sshPort), mono: true },
                { label: "Username", value: server.username, mono: true },
                { label: "Hostname", value: server.hostname ?? "—" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted">{f.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-foreground", f.mono && "font-mono text-[10px]")}>{f.value}</span>
                    {f.copyable && <button onClick={() => copy(f.value)} className="text-muted hover:text-primary"><Copy size={10} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Operating System */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Terminal size={13} className="text-success" />
              <h2 className="text-[12px] font-semibold text-foreground">System</h2>
            </div>
            <div className="divide-y divide-border/30 text-[11px]">
              {[
                { label: "OS", value: server.osName ? `${server.osName} ${server.osVersion ?? ""}` : server.os },
                { label: "Kernel", value: server.kernel ?? "—", mono: true },
                { label: "Architecture", value: server.arch ?? "—" },
                { label: "CPU Cores", value: server.cpuCores ? String(server.cpuCores) : "—" },
                { label: "Created", value: formatDate(server.createdAt) },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted">{f.label}</span>
                  <span className={cn("text-foreground", f.mono && "font-mono text-[10px]")}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        {server.notes && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[11px] text-muted font-medium mb-1">Notes</h3>
            <p className="text-[12px] text-foreground">{server.notes}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
