"use client";

import { useState, useEffect, useRef } from "react";
import { Menu, Bell, Search, Check, Trash2 } from "lucide-react";
import { formatRelativeTime, cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface TopBarProps {
  onMenuToggle: () => void;
  title?: string;
  subtitle?: string;
}

export function TopBar({ onMenuToggle, title, subtitle }: TopBarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch notifications when opened
  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications", { headers: { "x-user-id": "_" } });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data ?? []);
        setUnread(data.unreadCount ?? 0);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs) fetchNotifications();
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true, userId: "_" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* silent */ }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnread((c) => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const typeColors: Record<string, string> = {
    success: "bg-success",
    error: "bg-danger",
    warning: "bg-warning",
    info: "bg-primary",
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-bg/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-5">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="lg:hidden text-muted hover:text-foreground transition-colors">
          <Menu size={18} />
        </button>
        <div>
          {title && <h1 className="text-[13px] font-semibold text-foreground">{title}</h1>}
          {subtitle && <p className="text-[11px] text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="hidden md:flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 text-[11px] text-muted hover:text-secondary hover:border-border-hover transition-all group">
          <Search size={12} className="group-hover:text-secondary" />
          <span>Search</span>
          <div className="flex items-center gap-0.5 ml-3">
            <kbd className="font-mono text-[9px] text-muted/60 bg-bg px-1 py-0.5 rounded border border-border">⌘</kbd>
            <kbd className="font-mono text-[9px] text-muted/60 bg-bg px-1 py-0.5 rounded border border-border">K</kbd>
          </div>
        </button>

        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button onClick={handleToggle}
            className="relative p-2 rounded-lg text-muted hover:text-foreground hover:bg-card transition-all">
            <Bell size={15} />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-primary text-[8px] font-bold text-white rounded-full px-0.5">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {/* Notification Panel */}
          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#141418] border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden animate-scale-in z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-[12px] font-semibold text-foreground">Notifications</h3>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-primary hover:text-primary-hover font-medium transition-colors">
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell size={18} className="mx-auto text-muted mb-2" />
                    <p className="text-[11px] text-muted">No notifications</p>
                  </div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <div key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 border-b border-border/30 cursor-pointer hover:bg-card-hover/40 transition-colors",
                        !n.read && "bg-primary/3"
                      )}>
                      <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", typeColors[n.type] ?? "bg-muted")} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[11px] font-medium truncate", n.read ? "text-secondary" : "text-foreground")}>{n.title}</p>
                        <p className="text-[10px] text-muted truncate">{n.message}</p>
                        <p className="text-[9px] text-muted mt-0.5">{formatRelativeTime(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <button className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/80 to-purple flex items-center justify-center text-[10px] font-bold text-white ml-1">
          A
        </button>
      </div>
    </header>
  );
}
