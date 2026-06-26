"use client";

import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Trash2, RefreshCw, Loader2, Rocket, Play, Square, Terminal, Pencil } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { deleteServer, startServer, stopServer, rebootServer } from "@/actions/vps";
import { formatRelativeTime, cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NavItem } from "@/lib/navigation";

interface ServerRow {
  id: string;
  displayName: string;
  publicIp: string;
  status: string;
  provider: string;
  os: string;
  hostname: string | null;
  username: string;
  sshPort: number;
  cpuCores: number | null;
  ramTotalMb: number | null;
  diskTotalGb: number | null;
  diskUsedGb: number | null;
  environment: string;
  lastSeenAt: string | null;
  createdAt: string;
}

interface Props {
  servers: ServerRow[];
  nav?: NavItem[];
  user?: { name: string | null; email: string; workspaceName: string };
}

// Confirmation dialog component
function ConfirmDialog({ title, message, onConfirm, onCancel, destructive }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-[#141418] border border-border rounded-2xl p-6 shadow-2xl animate-scale-in">
        <h3 className="text-[14px] font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-[12px] text-secondary mb-5">{message}</p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="px-3.5 py-2 rounded-xl text-[12px] font-medium text-secondary hover:text-foreground hover:bg-card transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={cn("px-3.5 py-2 rounded-xl text-[12px] font-medium text-white transition-all",
              destructive ? "bg-danger hover:bg-danger/90" : "bg-primary hover:bg-primary-hover"
            )}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// Action buttons for each server row
function ServerActions({ server, loading, onAction }: {
  server: ServerRow;
  loading: boolean;
  onAction: (action: string) => void;
}) {
  const isOnline = server.status === "online";
  const isOffline = server.status === "offline";
  const isTransitioning = server.status === "starting" || server.status === "stopping";

  if (loading || isTransitioning) {
    return (
      <div className="flex items-center justify-end">
        <Loader2 size={14} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 justify-end">
      {/* Start — only when offline */}
      {isOffline && (
        <button onClick={() => onAction("start")}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-success hover:bg-success/10 transition-colors"
          title="Start Server">
          <Play size={13} />
        </button>
      )}

      {/* Stop — only when online */}
      {isOnline && (
        <button onClick={() => onAction("stop")}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-danger hover:bg-danger/10 transition-colors"
          title="Stop Server">
          <Square size={13} />
        </button>
      )}

      {/* Reboot — only when online */}
      {isOnline && (
        <button onClick={() => onAction("reboot")}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
          title="Reboot Server">
          <RefreshCw size={13} />
        </button>
      )}

      {/* Console — only when online */}
      {isOnline && (
        <Link href={`/console?server=${server.id}`}
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-purple hover:bg-purple/10 transition-colors"
          title="Open Console">
          <Terminal size={13} />
        </Link>
      )}

      {/* Edit — always */}
      <Link href={`/servers/${server.id}`}
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-muted hover:text-secondary hover:bg-card-hover transition-colors"
        title="Edit Server">
        <Pencil size={12} />
      </Link>

      {/* Delete — always */}
      <button onClick={() => onAction("delete")}
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-colors"
        title="Delete Server">
        <Trash2 size={12} />
      </button>
    </div>
  );
}

export function ServersClient({ servers, nav, user }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: string; name: string } | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return servers;
    const q = debouncedSearch.toLowerCase();
    return servers.filter((s) =>
      s.displayName.toLowerCase().includes(q) ||
      s.publicIp.includes(q) ||
      (s.hostname?.toLowerCase().includes(q) ?? false)
    );
  }, [servers, debouncedSearch]);

  const handleAction = (serverId: string, serverName: string, action: string) => {
    // Actions that need confirmation
    if (action === "stop" || action === "reboot" || action === "delete") {
      setConfirm({ id: serverId, action, name: serverName });
      return;
    }
    // Start executes directly
    executeAction(serverId, action);
  };

  const executeAction = async (serverId: string, action: string) => {
    setConfirm(null);
    setLoading(serverId);

    let result: { success?: boolean; error?: string };

    switch (action) {
      case "start":
        result = await startServer(serverId);
        break;
      case "stop":
        result = await stopServer(serverId);
        break;
      case "reboot":
        result = await rebootServer(serverId);
        break;
      case "delete":
        result = await deleteServer(serverId);
        break;
      default:
        result = { error: "Unknown action" };
    }

    setLoading(null);

    if (result.error) {
      toast(result.error, "error");
    } else {
      const messages: Record<string, string> = {
        start: "Server started successfully",
        stop: "Server stopped successfully",
        reboot: "Server reboot initiated",
        delete: "Server deleted",
      };
      toast(messages[action] ?? "Action completed", "success");
      router.refresh();
    }
  };

  const confirmMessages: Record<string, { title: string; message: string }> = {
    stop: { title: "Stop this server?", message: "The server will be powered off via SSH. You can restart it later." },
    reboot: { title: "Reboot this server?", message: "The server will restart. It may take a moment to come back online." },
    delete: { title: "Delete this server permanently?", message: "This will remove the server from NimbusPanel and delete the stored PEM key. This cannot be undone." },
  };

  return (
    <AppShell title="Servers" subtitle={`${servers.length} server${servers.length !== 1 ? "s" : ""}`} nav={nav} user={user}>
      <div className="space-y-4 animate-fade-in">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 w-full sm:max-w-xs">
            <Search size={13} className="text-muted shrink-0" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search servers..."
              className="bg-transparent border-none outline-none text-[13px] text-foreground placeholder:text-muted w-full" />
          </div>
          <Link href="/servers/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/10">
            <Plus size={13} /> Add Server
          </Link>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            servers.length === 0 ? (
              <EmptyState icon={Rocket} title="No servers yet" description="Add your first VPS to start managing infrastructure."
                primaryAction={<Link href="/servers/new" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"><Plus size={14} /> Add Server</Link>} />
            ) : (
              <EmptyState icon={Search} title="No results" description="Try a different search term." compact />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider">Server</th>
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider hidden md:table-cell">IP</th>
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider hidden lg:table-cell">Resources</th>
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider hidden xl:table-cell">Provider</th>
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider hidden sm:table-cell">Last Seen</th>
                    <th className="px-4 py-3 text-[10px] text-muted font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-border/30 hover:bg-card-hover/40 transition-colors group">
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status === "online" ? "running" : "stopped"} showLabel={false} size="md" />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/servers/${s.id}`} className="text-foreground font-medium hover:text-primary transition-colors">
                          {s.displayName}
                        </Link>
                        <p className="text-[10px] text-muted">{s.hostname ?? s.os}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell font-mono text-[10px] text-muted">{s.publicIp}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[10px] text-muted">
                        {s.cpuCores && <span>{s.cpuCores}C</span>}
                        {s.ramTotalMb && <span> · {Math.round(s.ramTotalMb / 1024)}G RAM</span>}
                        {s.diskTotalGb && <span> · {Math.round(s.diskTotalGb)}G Disk</span>}
                        {!s.cpuCores && !s.ramTotalMb && "—"}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-card-hover border border-border text-secondary capitalize">{s.provider}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[10px] text-muted">
                        {s.lastSeenAt ? formatRelativeTime(s.lastSeenAt) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <ServerActions
                          server={s}
                          loading={loading === s.id}
                          onAction={(action) => handleAction(s.id, s.displayName, action)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirm && confirmMessages[confirm.action] && (
        <ConfirmDialog
          title={confirmMessages[confirm.action].title}
          message={confirmMessages[confirm.action].message}
          destructive={confirm.action === "delete"}
          onConfirm={() => executeAction(confirm.id, confirm.action)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </AppShell>
  );
}
