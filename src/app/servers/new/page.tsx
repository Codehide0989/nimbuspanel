"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/components/ui/toast";
import { createServer, testSSH } from "@/actions/vps";
import { uploadPemKey } from "@/actions/files";
import {
  Plus, Loader2, CheckCircle, XCircle, Upload, Key, Wifi,
  FileKey, ArrowLeft, Server, Lock, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = ["AWS", "Azure", "Google Cloud", "Hetzner", "DigitalOcean", "Oracle", "Vultr", "Linode", "OVH", "Contabo", "Hostinger", "Other"];
const ENVIRONMENTS = ["Production", "Development", "Testing"];

export default function AddServerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const pemInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    displayName: "",
    publicIp: "",
    sshPort: 22,
    username: "root",
    authMethod: "password" as "key" | "password",
    password: "",
    keyPassphrase: "",
    provider: "Other",
    environment: "Production",
    notes: "",
    tags: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [pemKey, setPemKey] = useState<{ key: string; filename: string } | null>(null);
  const [pemUploading, setPemUploading] = useState(false);
  const [sshTesting, setSSHTesting] = useState(false);
  const [sshResult, setSSHResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string | number) => setForm((p) => ({ ...p, [field]: value }));

  const hasCredentials = form.authMethod === "password" ? !!form.password : !!pemKey;
  const canTest = !!form.publicIp && !!form.username && hasCredentials;
  const canSave = canTest && sshResult?.success && !!form.displayName;

  // Upload PEM
  const handlePemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPemUploading(true);
    setPemKey(null);
    setSSHResult(null);

    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadPemKey(formData);
    setPemUploading(false);

    if (result.error) toast(result.error, "error");
    else if (result.data) {
      setPemKey({ key: result.data.key, filename: file.name });
      toast("Private key uploaded securely", "success");
    }
    e.target.value = "";
  };

  // Test SSH
  const handleTestSSH = async () => {
    if (!canTest) return;
    setSSHTesting(true);
    setSSHResult(null);

    const testInput: Record<string, unknown> = {
      host: form.publicIp,
      port: form.sshPort,
      username: form.username,
      authMethod: form.authMethod,
    };

    if (form.authMethod === "password") {
      testInput.password = form.password;
    } else {
      testInput.pemKeyS3Key = pemKey!.key;
      if (form.keyPassphrase) testInput.keyPassphrase = form.keyPassphrase;
    }

    const result = await testSSH(testInput as Parameters<typeof testSSH>[0]);
    setSSHTesting(false);

    if ("error" in result) {
      setSSHResult({ success: false, message: result.error as string });
      toast(result.error as string, "error");
    } else {
      setSSHResult({ success: result.success, message: result.message });
      if (result.success) toast("Connection verified!", "success");
      else toast(result.message, "error");
    }
  };

  // Save
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    const result = await createServer({
      displayName: form.displayName,
      publicIp: form.publicIp,
      sshPort: form.sshPort,
      username: form.username,
      authMethod: form.authMethod,
      pemKeyS3Key: form.authMethod === "key" ? pemKey?.key : undefined,
      keyPassphrase: form.authMethod === "key" ? form.keyPassphrase || undefined : undefined,
      password: form.authMethod === "password" ? form.password : undefined,
      provider: form.provider.toLowerCase(),
      os: "linux",
      environment: form.environment.toLowerCase(),
      notes: form.notes || undefined,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    });

    setSaving(false);
    if (result.error) toast(result.error, "error");
    else { toast("Server added!", "success"); router.push("/servers"); }
  };

  return (
    <AppShell title="Add Server" subtitle="Connect any Linux VPS via SSH">
      <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
        <button onClick={() => router.push("/servers")} className="flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground transition-colors">
          <ArrowLeft size={13} /> Back to servers
        </button>

        {/* Connection Details */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Server size={15} className="text-primary" /><h2 className="text-[14px] font-semibold text-foreground">Connection</h2></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Server Name *</label>
              <input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} placeholder="my-server"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Host / IP *</label>
              <input value={form.publicIp} onChange={(e) => update("publicIp", e.target.value)} placeholder="203.0.113.42 or server.example.com"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted font-mono outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">SSH Port *</label>
              <input type="number" value={form.sshPort} onChange={(e) => update("sshPort", parseInt(e.target.value) || 22)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Username *</label>
              <input value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="root"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Lock size={14} className="text-primary" /><h3 className="text-[13px] font-semibold text-foreground">Authentication</h3></div>

          {/* Method selector */}
          <div className="flex bg-bg border border-border rounded-xl p-1">
            <button onClick={() => { update("authMethod", "password"); setSSHResult(null); }}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all",
                form.authMethod === "password" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted hover:text-foreground")}>
              <Lock size={11} /> Password
            </button>
            <button onClick={() => { update("authMethod", "key"); setSSHResult(null); }}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all",
                form.authMethod === "key" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted hover:text-foreground")}>
              <Key size={11} /> Private Key
            </button>
          </div>

          {/* Password auth */}
          {form.authMethod === "password" && (
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">SSH Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Enter SSH password"
                  className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors"
                />
                <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-muted mt-1.5">Password is encrypted with AES-256-GCM before storage. Never stored in plaintext.</p>
            </div>
          )}

          {/* Key auth */}
          {form.authMethod === "key" && (
            <div className="space-y-3">
              {!pemKey ? (
                <div>
                  <button onClick={() => pemInputRef.current?.click()} disabled={pemUploading}
                    className="w-full border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/40 transition-colors">
                    {pemUploading ? (
                      <div className="flex flex-col items-center gap-2"><Loader2 size={18} className="animate-spin text-primary" /><p className="text-[11px] text-secondary">Uploading...</p></div>
                    ) : (
                      <div className="flex flex-col items-center gap-2"><Upload size={18} className="text-muted" /><p className="text-[12px] text-foreground font-medium">Upload Private Key</p><p className="text-[10px] text-muted">.pem, .key, or OpenSSH format</p></div>
                    )}
                  </button>
                  <input ref={pemInputRef} type="file" accept=".pem,.key" className="hidden" onChange={handlePemUpload} />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/20">
                  <FileKey size={16} className="text-success" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground font-medium truncate">{pemKey.filename}</p>
                    <p className="text-[10px] text-muted">Stored in encrypted S3</p>
                  </div>
                  <button onClick={() => { setPemKey(null); setSSHResult(null); }} className="text-[10px] text-danger hover:underline">Remove</button>
                </div>
              )}
              <div>
                <label className="text-[10px] text-muted font-medium block mb-1.5">Key Passphrase (optional)</label>
                <input type="password" value={form.keyPassphrase} onChange={(e) => update("keyPassphrase", e.target.value)} placeholder="Leave empty if key is not encrypted"
                  className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h3 className="text-[12px] font-semibold text-foreground">Metadata</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Provider</label>
              <select value={form.provider} onChange={(e) => update("provider", e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[12px] text-foreground outline-none focus:border-primary/50 transition-colors">
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Environment</label>
              <select value={form.environment} onChange={(e) => update("environment", e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[12px] text-foreground outline-none focus:border-primary/50 transition-colors">
                {ENVIRONMENTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1.5">Tags (comma separated)</label>
            <input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="web, api, production"
              className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[12px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
          </div>
          <div>
            <label className="text-[10px] text-muted font-medium block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes..." rows={2}
              className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[12px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors resize-none" />
          </div>
        </div>

        {/* SSH Test */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2"><Wifi size={14} className="text-primary" /><h3 className="text-[13px] font-semibold text-foreground">Connection Test</h3></div>
          <p className="text-[11px] text-secondary">Verify SSH access before saving. System info will be collected automatically.</p>

          <button onClick={handleTestSSH} disabled={sshTesting || !canTest}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-bg border border-border text-foreground hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            {sshTesting ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
            {sshTesting ? "Testing..." : "Test SSH Connection"}
          </button>

          {sshResult && (
            <div className={cn("p-3 rounded-xl border flex items-center gap-2",
              sshResult.success ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20")}>
              {sshResult.success ? <CheckCircle size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
              <p className={cn("text-[12px] font-medium", sshResult.success ? "text-success" : "text-danger")}>{sshResult.message}</p>
            </div>
          )}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={!canSave || saving}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {saving ? "Adding server..." : "Save Server"}
        </button>

        {!canSave && canTest && !sshResult?.success && (
          <p className="text-[10px] text-warning text-center">⚠ Pass the SSH test to enable Save</p>
        )}
      </div>
    </AppShell>
  );
}
