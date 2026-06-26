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
  sessionToken: string;
  nav?: NavItem[];
  user?: { name: string | null; email: string; workspaceName: string };
}

export function ConsoleClient({ servers, sessionToken, nav, user }: Props) {
  const [selectedId, setSelectedId] = useState(servers.find((s) => s.status === "online")?.id ?? "");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const termRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [output, setOutput] = useState("");
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = servers.find((s) => s.id === selectedId);

  // Scroll to bottom on new output
  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [output]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  const getWsUrl = useCallback((serverId: string) => {
    // Always use the configured WebSocket endpoint (separate backend service)
    const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!configuredUrl) {
      return null;
    }
    const separator = configuredUrl.includes("?") ? "&" : "?";
    return `${configuredUrl}${separator}serverId=${serverId}&token=${sessionToken}`;
  }, [sessionToken]);

  const connect = useCallback((serverId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const wsUrl = getWsUrl(serverId);
    if (!wsUrl) {
      setError("Terminal server is not configured. Set NEXT_PUBLIC_WS_URL.");
      return;
    }

    setConnecting(true);
    setError("");
    setOutput("");

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Console] WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "connected":
            setConnecting(false);
            setConnected(true);
            inputRef.current?.focus();
            break;
          case "output":
            setOutput((prev) => prev + msg.data);
            break;
          case "error":
            setConnecting(false);
            setError(msg.message);
            break;
          case "disconnected":
            setConnected(false);
            setOutput((prev) => prev + `\r\n[${msg.reason || "Disconnected"}]\r\n`);
            break;
          case "pong":
            // Heartbeat response
            break;
        }
      } catch {
        // Non-JSON data
        setOutput((prev) => prev + event.data);
      }
    };

    ws.onclose = (event) => {
      console.log("[Console] WebSocket closed:", event.code, event.reason);
      setConnecting(false);
      wsRef.current = null;
      if (connected) {
        setConnected(false);
        setOutput((prev) => prev + "\r\n[Connection closed]\r\n");

        // Auto-reconnect with backoff (max 3 attempts)
        const attempt = (reconnectTimer.current as unknown as number) || 0;
        if (attempt < 3 && event.code !== 1000) { // 1000 = normal close
          const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
          setOutput((prev) => prev + `[Reconnecting in ${delay / 1000}s...]\r\n`);
          reconnectTimer.current = setTimeout(() => {
            (reconnectTimer.current as unknown as number) = attempt + 1;
            connect(selectedId);
          }, delay) as unknown as ReturnType<typeof setTimeout>;
        }
      }
    };

    ws.onerror = () => {
      setConnecting(false);
      setError("WebSocket connection failed. Ensure the server is running with: node server.js");
    };
  }, [getWsUrl, connected, selectedId]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const sendInput = useCallback((data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "input", data }));
    }
  }, []);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }, []);

  // Handle keystrokes
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!connected) return;
    e.preventDefault();

    let data = "";

    if (e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "c") data = "\x03";
      else if (key === "d") data = "\x04";
      else if (key === "l") data = "\x0c";
      else if (key === "z") data = "\x1a";
      else if (key === "a") data = "\x01";
      else if (key === "e") data = "\x05";
      else if (key === "u") data = "\x15";
      else if (key === "k") data = "\x0b";
      else if (key === "w") data = "\x17";
      else if (key === "r") data = "\x12";
      else if (key === "p") data = "\x10";
      else if (key === "n") data = "\x0e";
      else return;
    } else {
      switch (e.key) {
        case "Enter": data = "\r"; break;
        case "Backspace": data = "\x7f"; break;
        case "Delete": data = "\x1b[3~"; break;
        case "Tab": data = "\t"; break;
        case "Escape": data = "\x1b"; break;
        case "ArrowUp": data = "\x1b[A"; break;
        case "ArrowDown": data = "\x1b[B"; break;
        case "ArrowRight": data = "\x1b[C"; break;
        case "ArrowLeft": data = "\x1b[D"; break;
        case "Home": data = "\x1b[H"; break;
        case "End": data = "\x1b[F"; break;
        case "PageUp": data = "\x1b[5~"; break;
        case "PageDown": data = "\x1b[6~"; break;
        case "Insert": data = "\x1b[2~"; break;
        case "F1": data = "\x1bOP"; break;
        case "F2": data = "\x1bOQ"; break;
        case "F3": data = "\x1bOR"; break;
        case "F4": data = "\x1bOS"; break;
        default:
          if (e.key.length === 1) data = e.key;
          break;
      }
    }

    if (data) sendInput(data);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!connected) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    if (text) sendInput(text);
  };

  const handleServerChange = (newId: string) => {
    disconnect();
    setSelectedId(newId);
    setOutput("");
    setError("");
  };

  // Resize observer for terminal dimensions
  useEffect(() => {
    if (!termRef.current || !connected) return;
    const observer = new ResizeObserver(() => {
      if (termRef.current) {
        const cols = Math.floor(termRef.current.clientWidth / 7.2); // ~7.2px per char at 12px font
        const rows = Math.floor(termRef.current.clientHeight / 19.2); // ~19.2px per line
        sendResize(cols, rows);
      }
    });
    observer.observe(termRef.current);
    return () => observer.disconnect();
  }, [connected, sendResize]);

  // Render terminal output (strip some problematic sequences for display)
  const renderOutput = (raw: string): string => {
    return raw
      .replace(/\x1b\]0;[^\x07]*\x07/g, "")   // Strip window title changes
      .replace(/\x1b\][^\x07]*\x07/g, "")      // Strip OSC sequences
      .replace(/\r\n/g, "\n")
      .replace(/\r(?!\n)/g, "\r");
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
              <button onClick={() => selectedId && connect(selectedId)}
                disabled={connecting || !selectedId || selected?.status !== "online"}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium bg-success/10 text-success border border-success/20 hover:bg-success/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                {connecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                {connecting ? "Connecting..." : "Connect"}
              </button>
            ) : (
              <button onClick={disconnect}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-medium bg-danger/10 text-danger border border-danger/20 hover:bg-danger/15 transition-all">
                <WifiOff size={12} /> Disconnect
              </button>
            )}

            <div className="flex items-center gap-1.5 text-[10px] ml-auto">
              <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-success animate-pulse" : "bg-muted")} />
              <span className={connected ? "text-success" : "text-muted"}>
                {connected ? "Live" : connecting ? "Connecting" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Terminal Display */}
          <div
            ref={termRef}
            className="flex-1 relative bg-black border-x border-border overflow-hidden cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <pre className="absolute inset-0 p-3 overflow-y-auto font-mono text-[13px] leading-[1.5] text-[#D4D4D8] whitespace-pre-wrap break-all select-text">
              {!connected && !connecting && !output && !error && (
                <span className="text-[#52525B]">
                  {`Select a server and click Connect.\n\nThis is a real interactive SSH terminal.\nSupports: bash, nano, vim, top, htop, docker, and all commands.\n\nShortcuts:\n  Ctrl+C  Interrupt\n  Ctrl+D  Exit shell\n  Ctrl+L  Clear screen\n  Ctrl+Z  Suspend\n  Tab     Auto-complete`}
                </span>
              )}
              {error && <span className="text-[#EF4444]">{error}</span>}
              {output && renderOutput(output)}
            </pre>

            {/* Hidden input captures all keystrokes */}
            <textarea
              ref={inputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text resize-none outline-none"
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              autoFocus={connected}
              tabIndex={connected ? 0 : -1}
              aria-label="Terminal input"
            />
          </div>

          {/* Status Bar */}
          <div className="bg-[#0C0C0F] border border-border border-t-0 rounded-b-xl px-4 py-2 flex items-center justify-between text-[10px] text-[#52525B]">
            <span>{connected ? `${selected?.username}@${selected?.hostname ?? selected?.publicIp} · bash` : "Not connected"}</span>
            <span>Ctrl+C interrupt · Ctrl+D exit · Tab complete</span>
          </div>
        </div>
      )}
    </AppShell>
  );
}
