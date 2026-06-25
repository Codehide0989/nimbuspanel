"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Server, Plus, Terminal, Users, Settings,
  FolderOpen, Activity, Search, Zap, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  section: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  const commands: Command[] = [
    { id: "dash", label: "Dashboard", description: "Infrastructure overview", icon: <LayoutDashboard size={15} />, action: () => router.push("/dashboard"), section: "Navigation" },
    { id: "servers", label: "Servers", description: "Manage instances", icon: <Server size={15} />, action: () => router.push("/servers"), section: "Navigation" },
    { id: "add", label: "Add Server", description: "Import or connect", icon: <Plus size={15} />, action: () => router.push("/servers/new"), section: "Navigation" },
    { id: "console", label: "Console", description: "SSH terminal", icon: <Terminal size={15} />, action: () => router.push("/console"), section: "Navigation" },
    { id: "users", label: "Team", description: "Manage access", icon: <Users size={15} />, action: () => router.push("/users"), section: "Navigation" },
    { id: "storage", label: "Storage", description: "File manager", icon: <FolderOpen size={15} />, action: () => router.push("/storage"), section: "Navigation" },
    { id: "activity", label: "Activity", description: "Audit log", icon: <Activity size={15} />, action: () => router.push("/activity"), section: "Navigation" },
    { id: "settings", label: "Settings", description: "Workspace config", icon: <Settings size={15} />, action: () => router.push("/settings"), section: "Navigation" },
    { id: "sync", label: "Sync AWS", description: "Refresh all instances", icon: <Zap size={15} />, action: () => router.push("/servers/new"), section: "Actions" },
  ];

  const filtered = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return cmd.label.toLowerCase().includes(q) || cmd.description?.toLowerCase().includes(q);
  });

  const sections = Array.from(new Set(filtered.map((c) => c.section)));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); setQuery(""); setSelected(0); }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((i) => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && filtered[selected]) { filtered[selected].action(); setOpen(false); }
  }, [filtered, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[520px] glass-elevated rounded-2xl overflow-hidden animate-scale-in shadow-2xl">
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={15} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={onKey}
            placeholder="Search commands..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted"
            autoFocus
          />
          <kbd className="text-[10px] font-mono text-muted bg-bg px-1.5 py-0.5 rounded border border-border">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-1.5">
          {sections.map((section) => (
            <div key={section}>
              <p className="px-4 py-1.5 text-[10px] font-semibold text-muted uppercase tracking-wider">{section}</p>
              {filtered.filter((c) => c.section === section).map((cmd) => {
                const i = filtered.indexOf(cmd);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => { cmd.action(); setOpen(false); }}
                    onMouseEnter={() => setSelected(i)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      i === selected ? "bg-card" : "hover:bg-card/50"
                    )}
                  >
                    <span className="text-secondary">{cmd.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-foreground font-medium">{cmd.label}</p>
                      {cmd.description && <p className="text-[11px] text-muted">{cmd.description}</p>}
                    </div>
                    {i === selected && <ArrowRight size={12} className="text-muted" />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-[13px] text-muted py-8">No results found</p>
          )}
        </div>
      </div>
    </div>
  );
}
