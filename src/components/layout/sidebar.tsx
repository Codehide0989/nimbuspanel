"use client";

import { usePathname } from "next/navigation";
import { useEffect, useCallback } from "react";
import Link from "next/link";
import {
  X, ChevronDown, ChevronLeft, ChevronRight, HardDrive, Zap, LogOut,
  LayoutDashboard, Server, Terminal, Users, FolderOpen, Activity, Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Server, Terminal, Users, FolderOpen, Activity, Settings,
};

const SIDEBAR_KEY = "nimbus_sidebar_collapsed";

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  nav: NavItem[];
  user: { name: string | null; email: string; workspaceName: string };
  onLogout: () => void;
}

export function Sidebar({ isOpen, collapsed, onClose, onToggleCollapse, nav, user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onToggleCollapse();
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onToggleCollapse, onClose, isOpen]);

  const sidebarWidth = collapsed ? "w-[60px]" : "w-[230px]";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full z-50 flex flex-col",
          "bg-[#0C0C0F] border-r border-[#1A1A1F]",
          "transition-all duration-[280ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          sidebarWidth,
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className={cn("flex items-center h-[52px] border-b border-[#1A1A1F]", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <Link href="/dashboard" className="flex items-center gap-2.5 group" aria-label="NimbusPanel Home">
            <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-[#3B82F6] to-[#06B6D4] flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
              <Zap size={13} className="text-white" />
            </div>
            {!collapsed && (
              <span className="text-[13px] font-bold text-foreground tracking-[-0.01em]">NimbusPanel</span>
            )}
          </Link>
          {!collapsed && (
            <button onClick={onClose} className="lg:hidden text-muted hover:text-foreground transition-colors p-1 rounded-md" aria-label="Close sidebar">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Workspace */}
        {!collapsed ? (
          <div className="px-3 py-2.5 border-b border-[#1A1A1F]">
            <button className="w-full flex items-center justify-between px-2.5 py-[7px] rounded-[8px] text-[11px] bg-[#111114] border border-[#1F1F24] hover:border-[#2A2A32] hover:bg-[#141417] transition-all group">
              <div className="flex items-center gap-2">
                <div className="w-[18px] h-[18px] rounded-[5px] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <HardDrive size={9} className="text-primary" />
                </div>
                <span className="text-foreground font-medium truncate max-w-[120px]">{user.workspaceName}</span>
              </div>
              <ChevronDown size={11} className="text-muted group-hover:text-secondary transition-colors" />
            </button>
          </div>
        ) : (
          <div className="py-2.5 flex justify-center border-b border-[#1A1A1F]">
            <div className="w-7 h-7 rounded-[7px] bg-[#111114] border border-[#1F1F24] flex items-center justify-center">
              <HardDrive size={11} className="text-primary" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-[2px] overflow-y-auto" role="list">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = ICON_MAP[item.iconName] ?? LayoutDashboard;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                role="listitem"
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center rounded-[8px] transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  collapsed ? "justify-center h-9 w-9 mx-auto" : "gap-2.5 px-2.5 h-[34px]",
                  active
                    ? "bg-primary/[0.08] text-primary"
                    : "text-[#8B8B92] hover:text-foreground hover:bg-[#141417]"
                )}
              >
                {/* Active indicator */}
                {active && (
                  <div className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-primary transition-all",
                    collapsed ? "h-4 -left-[4px]" : "h-5 -left-[5px]"
                  )} />
                )}

                <Icon size={16} className={cn(
                  "shrink-0 transition-colors duration-150",
                  active ? "text-primary" : "text-[#5C5C66] group-hover:text-[#8B8B92]"
                )} />

                {!collapsed && (
                  <span className="text-[12.5px] font-medium tracking-[-0.01em]">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex px-2 py-1.5 border-t border-[#1A1A1F]">
          <button
            onClick={onToggleCollapse}
            className={cn(
              "flex items-center rounded-[7px] text-[#5C5C66] hover:text-foreground hover:bg-[#141417] transition-all",
              collapsed ? "justify-center w-9 h-8 mx-auto" : "gap-2 px-2.5 h-8 w-full"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand (⌘B)" : "Collapse (⌘B)"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span className="text-[11px]">Collapse</span>}
          </button>
        </div>

        {/* Profile */}
        <div className={cn("border-t border-[#1A1A1F]", collapsed ? "py-2.5 px-1.5" : "px-3 py-3")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 rounded-[7px] bg-gradient-to-br from-primary/70 to-[#8B5CF6] flex items-center justify-center text-[9px] font-bold text-white">
                {(user.name ?? user.email).slice(0, 2).toUpperCase()}
              </div>
              <button onClick={onLogout} className="text-[#5C5C66] hover:text-danger transition-colors p-1 rounded-md" title="Sign out" aria-label="Sign out">
                <LogOut size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-2 group">
              <div className="w-8 h-8 rounded-[8px] bg-gradient-to-br from-primary/70 to-[#8B5CF6] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                {(user.name ?? user.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-medium text-foreground truncate">{user.name ?? user.email}</p>
                <p className="text-[10px] text-[#5C5C66] truncate">{user.email}</p>
              </div>
              <button onClick={onLogout} className="text-[#5C5C66] hover:text-danger transition-colors p-1.5 rounded-md opacity-0 group-hover:opacity-100" title="Sign out" aria-label="Sign out">
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
