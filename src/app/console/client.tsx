"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Loader2, Wifi, WifiOff, ChevronDown, AlertCircle } from "lucide-react";
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

interface TermLine {
  content: string;
  type: "input" | "output" | "error" | "system";
}

export function ConsoleClient({ servers, nav, user }: Props) {
  const [selectedId, setSelectedId] = useState(servers.find((s) => s.status === "online")?.id ?? servers[0]?.id ?? "");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<TermLine[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [executing, setExecuting] = useState(false);
  const [cwd, setCwd] = useState("~");
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = servers.find((s) => s.id === selectedId);
  const prompt = selected ? `${selected.username}@${selected.hostname ?? selected.publicIp.split(".")[0]}:${cwd}$ ` : "$ ";

  // Auto scroll
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines]);

  // Focus input on click
  const focusInput = useCallback(() => inputRef.current?.focus(), []);

  const addLine = (content: string, type: TermLine["type"]) => {
    setLines((prev) => [...prev, { content, type }]);
  };

  const handleConnect = async () => {
    if (!selected || selected.status !== "online") return;
    setConnecting(true);
    setLines([]);
    setCwd("~");

    // Test connection with a simple command
    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selected.id, command: "pwd && whoami && uname -n" }),
      });
      const data = await res.json();

      setConnecting(false);

      if (!res.ok) {
        addLine(`Connection failed: ${data.error}`, "error");
        return;
      }

      setConnected(true);
      const parts = (data.stdout || "").split("\n").filter(Boolean);
      setCwd(parts[0] || "~");

      addLine(`Connected to ${selected.username}@${selected.publicIp}:${selected.hostname ?? ""}`, "system");
      addLine(`Working directory: ${parts[0] || "~"}`, "system");
      addLine("", "system");
      inputRef.current?.focus();
    } catch {
      setConnecting(false);
      addLine("Network error. Cannot reach the server.", "error");
    }
  };

  const handleDisconnect = () => {
    setConnected(false);
    addLine("Session closed.", "system");
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || !selected || executing) return;

    const trimmed = cmd.trim();
    setHistory((prev) => [...prev.filter((h) => h !== trimmed), trimmed]);
    setHistoryIdx(-1);
    addLine(`${prompt}${trimmed}`, "input");
    setInput("");

    // Handle local-only commands
    if (trimmed === "clear") { setLines([]); return; }
    if (trimmed === "exit" || trimmed === "logout") { handleDisconnect(); return; }

    setExecuting(true);

    try {
      // For cd commands, chain with pwd to track directory
      const actualCmd = trimmed.startsWith("cd ")
        ? `${trimmed} && pwd`
        : trimmed === "cd"
        ? "cd ~ && pwd"
        : trimmed;

      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverId: selected.id, command: actualCmd }),
      });
      const data = await res.json();

      if (!res.ok) {
        addLine(data.error || "Command failed", "error");
        // If connection error, mark disconnected
        if (res.status === 502 || res.status === 504) {
          setConnected(false);
          addLine("Connection lost. Use Connect to reconnect.", "system");
        }
      } else {
        const output = data.stdout || "";
        const stderr = data.stderr || "";

        // Handle cd — last line of stdout is the new pwd
        if (trimmed.startsWith("cd ") || trimmed === "cd") {
          const outputLines = output.split("\n").filter(Boolean);
          const newCwd = outputLines[outputLines.length - 1];
          if (newCwd && newCwd.startsWith("/")) {
            setCwd(newCwd);
            // Don't print the pwd output for cd
          } else if (stderr) {
            addLine(stderr, "error");
          }
        } else {
          // Print stdout
          if (output) {
            output.split("\n").forEach((line: string) => addLine(line, "output"));
          }
          // Print stderr
          if (stderr) {
            stderr.split("\n").forEach((line: string) => addLine(line, "error"));
          }
        }
      }
    } catch {
      addLine("Network error. Request failed.", "error");
    }

    setExecuting(false);
    inputRef.current?.focus();
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
      e.preventDefault();
      addLine(`${prompt}${input}^C`, "input");
      setInput("");
      setExecuting(false);
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    } else if (e.key === "d" && e.ctrlKey) {
      e.preventDefault();
      handleDisconnect();
    }
  };

  return (
    <AppShell title="Console" subtitle="SSH Terminal" nav={nav} user={user}>
      {servers.length === 0 ? (
        <EmptyState icon={Terminal} title="No servers available" description="Add a server first to use the SSH console." />
      ) : (
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0C0C0F] border border-border rounded-t-xl">
            <div className="relative flex-1 max-w-xs">
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setConnected(false); setLines([]); }}
                className="w-full appearance-none bg-[#111114] border border-[#1F1F24] rounded-lg px-3 py-2 pr-8 text-[12px] text-foreground outline-none focus:border-primary/50"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status !== "online"}>
                    {s.displayName} ({s.publicIp}) {s.status !== "online" ? "— offline" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {!connected ? (
              <button onClick={handleConnect} disabled={connecting || !selected || selected.status !== "online"}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium bg-success/10 text-success border border-success/20 hover:bg-success/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                {connecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                {connecting ? "Connecting..." : "Connect"}
              </button>
            ) : (
              <button onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-all">
                <WifiOff size={12} /> Disconnect
              </button>
            )}

            <div className="flex items-center gap-1.5 text-[10px] ml-auto">
              <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-success" : "bg-muted")} />
              <span className={connected ? "text-success" : "text-muted"}>
                {connected ? "Live" : connecting ? "Connecting" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Terminal Body */}
          <div
            ref={termRef}
            onClick={focusInput}
            className="flex-1 bg-[#0A0A0C] border-x border-border px-4 py-3 overflow-y-auto font-mono text-[12px] leading-[1.7] cursor-text select-text"
          >
            {!connected && !connecting && lines.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Terminal size={24} className="text-muted mb-3" />
                <p className="text-[12px] text-muted">Select a server and click Connect</p>
                <p className="text-[10px] text-muted/60 mt-1">Ctrl+L clear · Ctrl+C cancel · Ctrl+D disconnect</p>
              </div>
            )}

            {lines.map((line, i) => (
              <div key={i} className={cn("whitespace-pre-wrap break-all",
                line.type === "input" && "text-[#4ADE80]",
                line.type === "output" && "text-[#E4E4E7]",
                line.type === "error" && "text-[#F87171]",
                line.type === "system" && "text-[#6B7280] italic text-[11px]",
              )}>
                {line.content || "\u00A0"}
              </div>
            ))}

            {/* Active input line */}
            {connected && (
              <div className="flex items-center">
                <span className="text-[#4ADE80] whitespace-pre shrink-0">{prompt}</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={executing}
                  className="flex-1 bg-transparent border-none outline-none text-[#E4E4E7] font-mono text-[12px] caret-[#4ADE80] disabled:opacity-50"
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                  autoCapitalize="off"
                />
                {executing && <Loader2 size={11} className="animate-spin text-muted ml-1" />}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-[#0C0C0F] border border-border border-t-0 rounded-b-xl px-4 py-2 flex items-center justify-between text-[10px] text-muted">
            <span>{connected ? `${selected?.username}@${selected?.publicIp}` : "Not connected"}</span>
            <div className="flex items-center gap-3">
              <span>↑↓ History</span>
              <span>Ctrl+L Clear</span>
              <span>Ctrl+C Cancel</span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
