"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Loader2, Wifi, WifiOff, ChevronDown, Server } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

interface ServerOption {
  id: string;
  displayName: string;
  publicIp: string;
  status: string;
  username: string;
  hostname: string | null;
}

interface Props {
  servers: ServerOption[];
  nav?: NavItem[];
  user?: { name: string | null; email: string; workspaceName: string };
}

interface TerminalLine {
  text: string;
  type: "input" | "stdout" | "stderr" | "system";
}

export function ConsoleClient({ servers, nav, user }: Props) {
  const [selectedId, setSelectedId] = useState(servers[0]?.id ?? "");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<TerminalLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [cwd, setCwd] = useState("~");
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = servers.find((s) => s.id === selectedId);

  const scrollToBottom = useCallback(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [output, scrollToBottom]);

  const handleConnect = () => {
    if (!selected || selected.status !== "online") return;
    setConnecting(true);
    setOutput([]);

    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
      setOutput([
        { text: `Connected to ${selected.username}@${selected.publicIp}`, type: "system" },
        { text: `Hostname: ${selected.hostname ?? selected.publicIp}`, type: "system" },
        { text: "", type: "system" },
      ]);
      inputRef.current?.focus();
    }, 800);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setOutput((prev) => [...prev, { text: "Disconnected.", type: "system" }]);
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || !selected) return;

    setHistory((prev) => [...prev, cmd]);
    setHistoryIdx(-1);
    setOutput((prev) => [...prev, { text: `${selected.username}@${selected.hostname ?? "server"}:${cwd}$ ${cmd}`, type: "input" }]);
    setInput("");

    // Handle cd locally for cwd tracking
    if (cmd.startsWith("cd ")) {
      const dir = cmd.slice(3).trim();
      setCwd(dir === "~" ? "~" : dir.startsWith("/") ? dir : `${cwd}/${dir}`);
    }

    // Handle clear
    if (cmd === "clear") {
      setOutput([]);
      return;
    }

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selected.id, command: cmd }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOutput((prev) => [...prev, { text: data.error ?? "Command failed", type: "stderr" }]);
        return;
      }

      if (data.stdout) {
        data.stdout.split("\n").forEach((line: string) => {
          setOutput((prev) => [...prev, { text: line, type: "stdout" }]);
        });
      }
      if (data.stderr) {
        data.stderr.split("\n").forEach((line: string) => {
          setOutput((prev) => [...prev, { text: line, type: "stderr" }]);
        });
      }

      // Update cwd after cd
      if (cmd.startsWith("cd ") || cmd === "cd") {
        const pwdRes = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serverId: selected.id, command: "pwd" }),
        });
        const pwdData = await pwdRes.json();
        if (pwdData.stdout) setCwd(pwdData.stdout.trim());
      }
    } catch {
      setOutput((prev) => [...prev, { text: "Network error. Check your connection.", type: "stderr" }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const idx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx >= 0) {
        const idx = historyIdx + 1;
        if (idx >= history.length) { setHistoryIdx(-1); setInput(""); }
        else { setHistoryIdx(idx); setInput(history[idx]); }
      }
    } else if (e.key === "c" && e.ctrlKey) {
      setOutput((prev) => [...prev, { text: "^C", type: "system" }]);
      setInput("");
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setOutput([]);
    }
  };

  const prompt = selected ? `${selected.username}@${selected.hostname ?? "server"}:${cwd}$ ` : "$ ";

  return (
    <AppShell title="Console" subtitle="SSH Terminal" nav={nav} user={user}>
      {servers.length === 0 ? (
        <EmptyState icon={Terminal} title="No servers available" description="Add a server first to use the SSH console." />
      ) : (
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
          {/* Toolbar */}
          <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-t-xl">
            {/* Server selector */}
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setConnected(false); setOutput([]); }}
                className="w-full appearance-none bg-bg border border-border rounded-lg px-3 py-2 pr-8 text-[12px] text-foreground outline-none focus:border-primary/50"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status !== "online"}>
                    {s.displayName} ({s.publicIp}) {s.status !== "online" ? "— offline" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Connect/Disconnect */}
            {!connected ? (
              <button onClick={handleConnect} disabled={connecting || !selected || selected.status !== "online"}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {connecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                {connecting ? "Connecting..." : "Connect"}
              </button>
            ) : (
              <button onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-all">
                <WifiOff size={12} /> Disconnect
              </button>
            )}

            {/* Status */}
            <div className="flex items-center gap-1.5 text-[10px] ml-auto">
              <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-success" : "bg-muted")} />
              <span className={cn(connected ? "text-success" : "text-muted")}>
                {connected ? "Connected" : connecting ? "Connecting" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Terminal */}
          <div
            ref={termRef}
            onClick={() => inputRef.current?.focus()}
            className="flex-1 bg-[#0D0D0F] border-x border-border p-4 overflow-y-auto font-mono text-[12px] cursor-text select-text"
          >
            {!connected && !connecting && (
              <p className="text-muted">Select a server and click Connect to start an SSH session.</p>
            )}
            {connecting && (
              <p className="text-warning animate-pulse">Establishing SSH connection...</p>
            )}
            {output.map((line, i) => (
              <div key={i} className={cn("whitespace-pre-wrap break-all leading-5",
                line.type === "input" && "text-[#00FF88]",
                line.type === "stdout" && "text-[#E4E4E7]",
                line.type === "stderr" && "text-[#F87171]",
                line.type === "system" && "text-[#6B7280] italic",
              )}>
                {line.text || "\u00A0"}
              </div>
            ))}
            {/* Input line */}
            {connected && (
              <div className="flex items-center">
                <span className="text-[#00FF88] whitespace-pre">{prompt}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none text-[#E4E4E7] font-mono text-[12px] caret-[#00FF88]"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-card border border-border border-t-0 rounded-b-xl px-4 py-2 flex items-center justify-between text-[10px] text-muted">
            <span>{selected ? `${selected.username}@${selected.publicIp}:${selected.status === "online" ? "22" : "—"}` : "No server selected"}</span>
            <span>Press Ctrl+L to clear · Ctrl+C to cancel</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
