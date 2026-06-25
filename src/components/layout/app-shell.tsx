"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { ToastProvider } from "@/components/ui/toast";
import type { NavItem } from "@/lib/navigation";
import { logoutAction } from "@/app/login/logout-action";
import { cn } from "@/lib/utils";

const CommandPalette = dynamic(() => import("@/components/ui/command-palette").then((m) => ({ default: m.CommandPalette })), { ssr: false });

const SIDEBAR_KEY = "nimbus_sidebar_collapsed";

const DEFAULT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", iconName: "LayoutDashboard" },
  { href: "/servers", label: "Servers", iconName: "Server" },
  { href: "/console", label: "Console", iconName: "Terminal" },
  { href: "/storage", label: "Storage", iconName: "FolderOpen" },
  { href: "/users", label: "Team", iconName: "Users" },
  { href: "/activity", label: "Activity", iconName: "Activity" },
  { href: "/settings", label: "Settings", iconName: "Settings" },
];

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  nav?: NavItem[];
  user?: { name: string | null; email: string; workspaceName: string };
}

export function AppShell({ children, title, subtitle, nav, user }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Load persisted state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "true") setCollapsed(true);
    } catch { /* ignore */ }
    setMounted(true);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleLogout = async () => {
    await logoutAction();
    router.push("/login");
  };

  const effectiveNav = nav ?? DEFAULT_NAV;
  const effectiveUser = user ?? { name: "User", email: "", workspaceName: "Workspace" };

  // Prevent layout flash before hydration
  const marginLeft = mounted ? (collapsed ? "lg:ml-[60px]" : "lg:ml-[230px]") : "lg:ml-[230px]";

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <Sidebar
          isOpen={sidebarOpen}
          collapsed={collapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={handleToggleCollapse}
          nav={effectiveNav}
          user={effectiveUser}
          onLogout={handleLogout}
        />
        <div className={cn("min-h-screen flex flex-col transition-[margin] duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]", marginLeft)}>
          <TopBar onMenuToggle={() => setSidebarOpen(true)} title={title} subtitle={subtitle} />
          <main className="flex-1 p-4 lg:p-5">{children}</main>
        </div>
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
