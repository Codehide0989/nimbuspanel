"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Users, UserPlus, Clock, X, Loader2, Mail, MoreVertical, Shield, RefreshCw, UserMinus, Ban, Check } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { inviteUser, revokeInvitation, resendInvitation, changeUserRole, disableUser, enableUser, removeMember } from "@/actions/invitations";
import { getRoleLabel } from "@/lib/permissions";
import { formatRelativeTime, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { NavItem } from "@/lib/navigation";
import type { Role } from "@prisma/client";

interface Member { id: string; email: string; name: string | null; role: string; isActive: boolean; joinedAt: string; lastLoginAt: string | null; }
interface Invitation { id: string; email: string; role: string; status: string; createdAt: string; expiresAt: string; }
interface Props {
  members: Member[];
  invitations: Invitation[];
  currentUserRole: string;
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

const statusBadges: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
  ACCEPTED: { label: "Accepted", color: "bg-success/10 text-success border-success/20" },
  EXPIRED: { label: "Expired", color: "bg-muted/10 text-muted border-border" },
  REVOKED: { label: "Revoked", color: "bg-danger/10 text-danger border-danger/20" },
};

const roleDescriptions: Record<string, string> = {
  READ_ONLY: "View server info only",
  OPERATOR: "Start, stop, reboot instances",
  SSH_USER: "Terminal access to servers",
  ADMIN: "Full management access",
  OWNER: "Complete control",
};

// ─── Invite Modal ─────────────────────────────────────────────

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | "SSH_USER" | "READ_ONLY">("READ_ONLY");
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setMounted(true); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  const handleInvite = async () => {
    if (!email) { toast("Email is required", "warning"); return; }
    setSending(true);
    const result = await inviteUser({ email, role });
    setSending(false);

    if (result.error) { toast(result.error, "error"); return; }
    if (result.warning) { toast(result.warning, "warning"); }
    else { toast(`Invitation sent to ${email}`, "success"); }
    onSuccess();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#141418] border border-border rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <UserPlus size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Invite Team Member</h3>
              <p className="text-[11px] text-secondary mt-0.5">They'll receive an email with credentials</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted hover:text-foreground hover:bg-card transition-colors"><X size={16} /></button>
        </div>
        <div className="px-6 pb-6 space-y-5">
          <div>
            <label className="text-[11px] text-muted font-medium block mb-2">Email address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" autoFocus
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
          </div>
          <div>
            <label className="text-[11px] text-muted font-medium block mb-2">Role</label>
            <div className="space-y-2">
              {(["READ_ONLY", "OPERATOR", "SSH_USER", "ADMIN"] as const).map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={cn("w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all",
                    role === r ? "bg-primary/5 border-primary/40" : "bg-bg/50 border-border hover:border-border-hover")}>
                  <div>
                    <p className={cn("text-[12px] font-medium", role === r ? "text-primary" : "text-foreground")}>{getRoleLabel(r)}</p>
                    <p className="text-[10px] text-muted mt-0.5">{roleDescriptions[r]}</p>
                  </div>
                  <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", role === r ? "border-primary" : "border-border")}>
                    {role === r && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleInvite} disabled={sending || !email}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            {sending ? "Sending..." : "Send Invitation"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Role Editor Modal ──────────────────────────────────────────

function RoleEditorModal({ member, onClose, onSuccess }: { member: Member; onClose: () => void; onSuccess: () => void }) {
  const [role, setRole] = useState(member.role as Role);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setMounted(true); document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  const handleSave = async () => {
    if (role === member.role) { onClose(); return; }
    setSaving(true);
    const result = await changeUserRole(member.id, role);
    setSaving(false);
    if (result.error) { toast(result.error, "error"); return; }
    toast(`Role updated to ${getRoleLabel(role)}`, "success");
    onSuccess();
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#141418] border border-border rounded-2xl shadow-2xl animate-scale-in p-6">
        <h3 className="text-[14px] font-semibold text-foreground mb-1">Edit Role</h3>
        <p className="text-[11px] text-secondary mb-4">{member.name ?? member.email}</p>
        <div className="space-y-2 mb-5">
          {(["READ_ONLY", "OPERATOR", "SSH_USER", "ADMIN", "OWNER"] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)}
              className={cn("w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all",
                role === r ? "bg-primary/5 border-primary/40" : "bg-bg border-border hover:border-border-hover")}>
              <span className={cn("text-[12px] font-medium", role === r ? "text-primary" : "text-foreground")}>{getRoleLabel(r)}</span>
              {role === r && <Check size={12} className="text-primary" />}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-xl text-[12px] font-medium text-secondary hover:text-foreground hover:bg-card transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-3 py-2 rounded-xl text-[12px] font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function UsersClient({ members, invitations, currentUserRole, nav, user }: Props) {
  const [showInvite, setShowInvite] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const isManager = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const handleResend = async (id: string) => {
    setActionLoading(id);
    const result = await resendInvitation(id);
    setActionLoading(null);
    if (result.error) toast(result.error, "error");
    else { toast("Invitation resent", "success"); router.refresh(); }
  };

  const handleRevoke = async (id: string) => {
    setActionLoading(id);
    const result = await revokeInvitation(id);
    setActionLoading(null);
    if (result.error) toast(result.error, "error");
    else { toast("Invitation revoked", "success"); router.refresh(); }
  };

  const handleDisable = async (id: string) => {
    setActionLoading(id);
    const result = await disableUser(id);
    setActionLoading(null);
    if (result.error) toast(result.error, "error");
    else { toast("Account disabled", "success"); router.refresh(); }
  };

  const handleEnable = async (id: string) => {
    setActionLoading(id);
    const result = await enableUser(id);
    setActionLoading(null);
    if (result.error) toast(result.error, "error");
    else { toast("Account enabled", "success"); router.refresh(); }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from this workspace?`)) return;
    setActionLoading(id);
    const result = await removeMember(id);
    setActionLoading(null);
    if (result.error) toast(result.error, "error");
    else { toast("Member removed", "success"); router.refresh(); }
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
          {isManager && (
            <button onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/10">
              <UserPlus size={13} /> Invite
            </button>
          )}
        </div>

        {/* Members */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users size={13} className="text-muted" />
            <h2 className="text-[12px] font-semibold text-foreground">Members</h2>
          </div>
          {members.length === 0 ? (
            <EmptyState icon={Users} title="No team members" description="Invite colleagues to collaborate." compact />
          ) : (
            <div className="divide-y divide-border/30">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-card-hover/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold",
                      m.isActive ? "bg-gradient-to-br from-primary/20 to-purple/20 border border-border text-foreground" : "bg-muted/10 border border-border text-muted"
                    )}>
                      {(m.name ?? m.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] text-foreground font-medium">{m.name ?? m.email}</p>
                        {!m.isActive && <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">Disabled</span>}
                      </div>
                      {m.name && <p className="text-[10px] text-muted">{m.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium px-2 py-1 rounded-lg border", roleColors[m.role] ?? roleColors.READ_ONLY)}>
                      {getRoleLabel(m.role as Role)}
                    </span>
                    {isManager && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => setEditMember(m)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card transition-colors" title="Edit role">
                          <Shield size={11} />
                        </button>
                        {m.isActive ? (
                          <button onClick={() => handleDisable(m.id)} disabled={actionLoading === m.id} className="p-1.5 rounded-lg text-muted hover:text-warning hover:bg-warning/10 transition-colors" title="Disable">
                            {actionLoading === m.id ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
                          </button>
                        ) : (
                          <button onClick={() => handleEnable(m.id)} disabled={actionLoading === m.id} className="p-1.5 rounded-lg text-muted hover:text-success hover:bg-success/10 transition-colors" title="Enable">
                            {actionLoading === m.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          </button>
                        )}
                        <button onClick={() => handleRemove(m.id, m.email)} disabled={actionLoading === m.id} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Remove">
                          <UserMinus size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invitations */}
        {invitations.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Clock size={13} className="text-warning" />
              <h2 className="text-[12px] font-semibold text-foreground">Invitations</h2>
            </div>
            <div className="divide-y divide-border/30">
              {invitations.map((inv) => {
                const badge = statusBadges[inv.status] ?? statusBadges.PENDING;
                return (
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
                      <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-lg border", badge.color)}>{badge.label}</span>
                      <span className={cn("text-[10px] font-medium px-2 py-1 rounded-lg border", roleColors[inv.role] ?? roleColors.READ_ONLY)}>
                        {getRoleLabel(inv.role as Role)}
                      </span>
                      {isManager && inv.status === "PENDING" && (
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => handleResend(inv.id)} disabled={actionLoading === inv.id}
                            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors" title="Resend">
                            {actionLoading === inv.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                          </button>
                          <button onClick={() => handleRevoke(inv.id)} disabled={actionLoading === inv.id}
                            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors" title="Revoke">
                            <X size={11} />
                          </button>
                        </div>
                      )}
                      {inv.status === "EXPIRED" && isManager && (
                        <button onClick={() => handleResend(inv.id)} disabled={actionLoading === inv.id}
                          className="text-[10px] text-primary hover:text-primary-hover font-medium transition-colors">
                          Resend
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSuccess={() => { setShowInvite(false); router.refresh(); }} />}
      {editMember && <RoleEditorModal member={editMember} onClose={() => setEditMember(null)} onSuccess={() => { setEditMember(null); router.refresh(); }} />}
    </AppShell>
  );
}
