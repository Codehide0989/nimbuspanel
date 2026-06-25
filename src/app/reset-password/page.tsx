"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Zap, CheckCircle } from "lucide-react";
import { resetPasswordAction } from "./actions";
import Link from "next/link";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setLoading(true);
    const result = await resetPasswordAction(token, password);
    setLoading(false);

    if (result.error) setError(result.error);
    else setSuccess(true);
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-danger text-[13px]">Invalid reset link. No token provided.</p>
        <Link href="/login" className="text-primary text-[12px] mt-4 inline-block">Back to login</Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle size={32} className="text-success mx-auto mb-4" />
        <h2 className="text-lg font-bold text-foreground mb-2">Password Reset</h2>
        <p className="text-[13px] text-secondary mb-4">Your password has been updated. You can now sign in.</p>
        <Link href="/login" className="text-primary text-[13px] font-medium">Go to Login</Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold text-foreground mb-1">New Password</h2>
      <p className="text-[13px] text-secondary mb-6">Enter your new password below.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] text-muted font-medium block mb-1.5">New Password</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50" />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted font-medium block mb-1.5">Confirm</label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" required
              className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50" />
          </div>
        </div>
        {error && <div className="p-3 rounded-xl bg-danger/5 border border-danger/20"><p className="text-[12px] text-danger">{error}</p></div>}
        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Reset Password
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-success flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-[14px] font-bold text-foreground">NimbusPanel</span>
        </div>
        <Suspense fallback={<div />}><ResetForm /></Suspense>
      </div>
    </div>
  );
}
