"use client";

import { useState } from "react";
import { Loader2, Mail, Zap, ArrowLeft, CheckCircle } from "lucide-react";
import { forgotPasswordAction } from "./actions";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await forgotPasswordAction(email);
    setLoading(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-success flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <span className="text-[14px] font-bold text-foreground">NimbusPanel</span>
        </div>

        {!sent ? (
          <>
            <h2 className="text-xl font-bold text-foreground mb-1">Reset Password</h2>
            <p className="text-[13px] text-secondary mb-6">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] text-muted font-medium block mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required
                    className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50" />
                </div>
              </div>
              <button type="submit" disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                Send Reset Link
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle size={32} className="text-success mx-auto mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-2">Check your email</h2>
            <p className="text-[13px] text-secondary">If an account exists for {email}, you'll receive a reset link.</p>
          </div>
        )}

        <Link href="/login" className="flex items-center justify-center gap-1 text-[12px] text-secondary hover:text-foreground mt-6 transition-colors">
          <ArrowLeft size={12} /> Back to login
        </Link>
      </div>
    </div>
  );
}
