"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, UserPlus, Clock, X, Loader2, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { inviteUser, revokeInvitation } from "@/actions/invitations";
import { getRoleLabel } from "@/lib/permissions";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { NavItem } from "@/lib/navigation";

interface Member { id: string; email: string; name: string | null; role: string; joinedAt: string; }
interface Invitation { id: string; email: string; role: string; status: string; createdAt: string; expiresAt: string; }
interface Props {
  members: Member[];
  invitations: Invitation[];
  nav?: NavItem[];
  user?: { name: string | null; email: string; workspaceName: string };
}

const roleColors: Record<string, string> = {
  OWNER: "bg-primary/10 text-primary border-primary/20",
  ADMIN: "bg-success/10 text-success border-success/20",
  OPERATOR: "bg-warning/10 text-warning border-warning/20",
  SSH_USER: "bg-purple/10 text-purple border-purple/20",
  READ_ONLY: "bg-card text-muted border-border",
};

const roleDescriptions: Record<string, string> = {
  READ_ONLY: "View server info only",
  OPERATOR: "Start, stop, reboot instances",
  SSH_USER: "Terminal access to servers",
  ADMIN: "Full management access",
};

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | "SSH_USER" | "READ_ONLY">("READ_ONLY");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  const handleInvite = async () => {
    if (!email) { toast("Email is required", "warning"); return; }
    setSending(true);
    const result = await inviteUser({ email, role });
    setSending(false);
    if (result.error) toast(result.error, "error");
    else { toast(`Invitation sent to ${email}`, "success"); onSuccess(); }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#141418] border border-border rounded-2xl shadow-2xl shadow-black/50 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UserPlus size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Invite Team Member</h3>
              <p className="text-[11px] text-secondary mt-0.5">They'll receive an email with access instructions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-card transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5">
          {/* Email */}
          <div>
            <label className="text-[11px] text-muted font-medium block mb-2">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              autoFocus
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="text-[11px] text-muted font-medium block mb-2">Permission level</label>
            <div className="space-y-2">
              {(["READ_ONLY", "OPERATOR", "SSH_USER", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    "w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all duration-150",
                    role === r
                      ? "bg-primary/5 border-primary/40 shadow-sm shadow-primary/5"
                      : "bg-bg/50 border-border hover:border-border-hover hover:bg-bg"
                  )}
                >
                  <div>
                    <p className={cn("text-[12px] font-medium", role === r ? "text-primary" : "text-foreground")}>
                      {getRoleLabel(r)}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">{roleDescriptions[r]}</p>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                    role === r ? "border-primary" : "border-border"
                  )}>
                    {role === r && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleInvite}
            disabled={sending || !email}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {sending ? "Sending..." : "Send Invitation"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function UsersClient({ members, invitations, nav, user }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleRevoke = async (id: string) => {
    const result = await revokeInvitation(id);
    if (result.error) toast(result.error, "error");
    else { toast("Invitation revoked", "success"); router.refresh(); }
  };

  return (
    <AppShell title="Team" subtitle="Manage workspace access and permissions" nav={nav} user={user}>
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-secondary">
            <span>{members.length} member{members.length !== 1 ? "s" : ""}</span>
            {invitations.length > 0 && <span>· {invitations.length} pending</span>}
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/10"
          >
            <UserPlus size={13} /> Invite
          </button>
        </div>

        {/* Members */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users size={13} className="text-muted" />
            <h2 className="text-[12px] font-semibold text-foreground">Members</h2>
          </div>
          {members.length === 0 ? (
            <EmptyState icon={Users} title="No team members" description="Invite colleagues to collaborate on infrastructure." compact />
          ) : (
            <div className="divide-y divide-border/30">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-card-hover/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-purple/20 border border-border flex items-center justify-center text-[10px] font-bold text-foreground">
                      {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground font-medium">{m.name ?? m.email}</p>
                      {m.name && <p className="text-[10px] text-muted">{m.email}</p>}
                    </div>
                  </div>
                  <span className={cn("text-[10px] font-medium px-2 py-1 rounded-lg border", roleColors[m.role] ?? roleColors.READ_ONLY)}>
                    {getRoleLabel(m.role as "OWNER" | "ADMIN" | "OPERATOR" | "SSH_USER" | "READ_ONLY")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Clock size={13} className="text-warning" />
              <h2 className="text-[12px] font-semibold text-foreground">Pending Invitations</h2>
            </div>
            <div className="divide-y divide-border/30">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-card-hover/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
                      <Mail size={12} className="text-warning" />
                    </div>
                    <div>
                      <p className="text-[12px] text-foreground">{inv.email}</p>
                      <p className="text-[10px] text-muted">{formatRelativeTime(inv.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium px-2 py-1 rounded-lg border", roleColors[inv.role] ?? roleColors.READ_ONLY)}>
                      {getRoleLabel(inv.role as "ADMIN" | "OPERATOR" | "SSH_USER" | "READ_ONLY")}
                    </span>
                    <button onClick={() => handleRevoke(inv.id)} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal — portaled to document.body to avoid z-index/overlap issues */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); router.refresh(); }}
        />
      )}
    </AppShell>
  );
}
