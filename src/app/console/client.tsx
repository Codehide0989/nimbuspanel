"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Loader2, Wifi, WifiOff, ChevronDown } from "lucide-react";
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

export function ConsoleClient({ servers, nav, user }: Props) {
  const [selectedId, setSelectedId] = useState(servers.find((s) => s.status === "online")?.id ?? "");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const termRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [output, setOutput] = useState("");

  const selected = servers.find((s) => s.id === selectedId);

  // Auto-scroll terminal
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  const api = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch("/api/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const startPolling = useCallback((serverId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const data = await api({ action: "read", serverId });
        if (data.output) {
          setOutput((prev) => prev + data.output);
        }
        if (data.alive === false) {
          setConnected(false);
          stopPolling();
          setOutput((prev) => prev + "\r\n\x1b[31m[Connection lost]\x1b[0m\r\n");
        }
      } catch {
        // Network error, keep trying
      }
    }, 100); // Poll every 100ms for responsive feel
  }, [api]);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleConnect = async () => {
    if (!selected || selected.status !== "online") return;
    setConnecting(true);
    setError("");
    setOutput("");

    const data = await api({ action: "connect", serverId: selected.id });

    setConnecting(false);
    if (data.error) {
      setError(data.error);
      return;
    }

    setConnected(true);
    if (data.output) setOutput(data.output);
    startPolling(selected.id);
    inputRef.current?.focus();
  };

  const handleDisconnect = async () => {
    stopPolling();
    if (selected) await api({ action: "disconnect", serverId: selected.id });
    setConnected(false);
    setOutput((prev) => prev + "\r\n\x1b[2m[Disconnected]\x1b[0m\r\n");
  };

  const handleInput = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!connected || !selected) return;
    e.preventDefault();

    let data = "";

    if (e.key === "Enter") data = "\r";
    else if (e.key === "Backspace") data = "\x7f";
    else if (e.key === "Delete") data = "\x1b[3~";
    else if (e.key === "Tab") data = "\t";
    else if (e.key === "Escape") data = "\x1b";
    else if (e.key === "ArrowUp") data = "\x1b[A";
    else if (e.key === "ArrowDown") data = "\x1b[B";
    else if (e.key === "ArrowRight") data = "\x1b[C";
    else if (e.key === "ArrowLeft") data = "\x1b[D";
    else if (e.key === "Home") data = "\x1b[H";
    else if (e.key === "End") data = "\x1b[F";
    else if (e.ctrlKey && e.key === "c") data = "\x03";
    else if (e.ctrlKey && e.key === "d") data = "\x04";
    else if (e.ctrlKey && e.key === "l") data = "\x0c";
    else if (e.ctrlKey && e.key === "z") data = "\x1a";
    else if (e.ctrlKey && e.key === "a") data = "\x01";
    else if (e.ctrlKey && e.key === "e") data = "\x05";
    else if (e.ctrlKey && e.key === "u") data = "\x15";
    else if (e.ctrlKey && e.key === "k") data = "\x0b";
    else if (e.ctrlKey && e.key === "w") data = "\x17";
    else if (e.key.length === 1) data = e.key;

    if (data) {
      api({ action: "write", serverId: selected.id, data });
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!connected || !selected) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (text) api({ action: "write", serverId: selected.id, data: text });
  };

  // Strip ANSI for display (basic rendering)
  const renderOutput = (raw: string): string => {
    // Keep raw for now — the terminal styling will show escape codes
    // A proper xterm.js integration would render these perfectly
    // For HTTP-based approach, strip most ANSI for readability
    return raw
      .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "") // mode changes
      .replace(/\x1b\[[0-9;]*[HJK]/g, "")        // cursor/clear
      .replace(/\x1b\[[0-9;]*m/g, "")            // colors (strip for plain display)
      .replace(/\x1b\][^\x07]*\x07/g, "")        // OSC sequences
      .replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]/g, "") // remaining
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
  };

  const handleServerChange = async (newId: string) => {
    if (connected && selected) {
      stopPolling();
      await api({ action: "disconnect", serverId: selected.id });
    }
    setSelectedId(newId);
    setConnected(false);
    setOutput("");
    setError("");
  };

  return (
    <AppShell title="Console" subtitle="Interactive SSH Terminal" nav={nav} user={user}>
      {servers.length === 0 ? (
        <EmptyState icon={Terminal} title="No servers available" description="Add a server to use the SSH console." />
      ) : (
        <div className="flex flex-col h-[calc(100vh-8rem)] animate-fade-in">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0C0C0F] border border-border rounded-t-xl">
            <div className="relative flex-1 max-w-xs">
              <select value={selectedId} onChange={(e) => handleServerChange(e.target.value)}
                className="w-full appearance-none bg-[#111114] border border-[#1F1F24] rounded-lg px-3 py-2 pr-8 text-[12px] text-foreground outline-none focus:border-primary/50">
                <option value="">Select server...</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.status !== "online"}>
                    {s.displayName} ({s.publicIp}) {s.status !== "online" ? "— offline" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {!connected ? (
              <button onClick={handleConnect} disabled={connecting || !selectedId || selected?.status !== "online"}
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
                {connected ? "Live Shell" : connecting ? "Connecting" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Terminal */}
          <div className="flex-1 relative bg-[#0A0A0C] border-x border-border overflow-hidden" onClick={() => inputRef.current?.focus()}>
            <pre
              ref={termRef}
              className="absolute inset-0 p-4 overflow-y-auto font-mono text-[12px] leading-[1.6] text-[#E4E4E7] whitespace-pre-wrap break-all select-text"
            >
              {!connected && !connecting && !output && (
                <span className="text-muted">Select a server and click Connect to start an interactive SSH session.{"\n\n"}Supports: bash, nano, vim, top, htop, docker, and all standard commands.{"\n"}Shortcuts: Ctrl+C, Ctrl+D, Ctrl+L, Ctrl+Z, Tab, Arrow keys</span>
              )}
              {error && <span className="text-[#F87171]">{error}</span>}
              {output && renderOutput(output)}
            </pre>

            {/* Hidden textarea captures all keyboard input */}
            <textarea
              ref={inputRef}
              className="absolute inset-0 opacity-0 cursor-text resize-none"
              onKeyDown={handleInput}
              onPaste={handlePaste}
              autoFocus={connected}
              aria-label="Terminal input"
            />
          </div>

          {/* Footer */}
          <div className="bg-[#0C0C0F] border border-border border-t-0 rounded-b-xl px-4 py-2 flex items-center justify-between text-[10px] text-muted">
            <span>{connected ? `${selected?.username}@${selected?.hostname ?? selected?.publicIp} · Interactive Shell` : "Not connected"}</span>
            <span>Ctrl+C interrupt · Ctrl+D exit · Ctrl+L clear · Tab complete</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
