"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail, Shield, Server, Zap } from "lucide-react";
import { loginAction } from "./actions";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capsLock, setCapsLock] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await loginAction({ email, password, rememberMe });

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.mustChangePassword) {
      router.push("/change-password");
    } else {
      router.push(redirect);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-surface/50 border-r border-border flex-col justify-between p-10">
        <div>
          <div className="flex items-center gap-2 mb-16">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-success flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <span className="text-[15px] font-bold text-foreground">NimbusPanel</span>
          </div>

          <h1 className="text-3xl font-bold text-foreground leading-tight mb-4">
            Enterprise Cloud<br />Infrastructure Manager
          </h1>
          <p className="text-secondary text-[14px] leading-relaxed max-w-md">
            Manage EC2 instances, monitor performance, control access, and automate your cloud operations from one secure dashboard.
          </p>
        </div>

        <div className="space-y-4">
          {[
            { icon: Shield, text: "AES-256 encrypted credentials" },
            { icon: Server, text: "Real-time EC2 instance management" },
            { icon: Lock, text: "Role-based access control" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <item.icon size={14} className="text-primary" />
              </div>
              <span className="text-[13px] text-secondary">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-success flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
            <span className="text-[14px] font-bold text-foreground">NimbusPanel</span>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-1">Sign in</h2>
          <p className="text-[13px] text-secondary mb-6">Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-[11px] text-muted font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="admin@nimbuspanel.com"
                  required
                  className="w-full bg-card border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] text-muted font-medium">Password</label>
                <a href="/forgot-password" className="text-[10px] text-primary hover:text-primary-hover transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  required
                  className="w-full bg-card border border-border rounded-xl pl-9 pr-10 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-secondary transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {capsLock && (
                <p className="text-[10px] text-warning mt-1">⚠ Caps Lock is on</p>
              )}
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border bg-card text-primary"
              />
              <span className="text-[11px] text-secondary">Remember me for 90 days</span>
            </label>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-danger/5 border border-danger/20">
                <p className="text-[12px] text-danger">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-[10px] text-muted text-center mt-6">
            Only authorized users can access this platform.<br />
            Contact your administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginForm />
    </Suspense>
  );
}
