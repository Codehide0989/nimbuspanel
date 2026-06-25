"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/components/ui/toast";
import { createServer, testSSH } from "@/actions/vps";
import { uploadPemKey } from "@/actions/files";
import {
  Plus, Loader2, CheckCircle, XCircle, Upload, Key, Wifi,
  FileKey, ArrowLeft, Server, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OS_OPTIONS = ["Ubuntu", "Debian", "CentOS", "Rocky Linux", "AlmaLinux", "Fedora", "Arch", "Custom"];
const PROVIDER_OPTIONS = ["AWS", "Azure", "Google Cloud", "Hetzner", "DigitalOcean", "Vultr", "Linode", "Oracle", "OVH", "Other"];
const ENV_OPTIONS = ["Production", "Development", "Testing"];

export default function AddServerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const pemInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    displayName: "",
    publicIp: "",
    sshPort: 22,
    username: "root",
    os: "Ubuntu",
    provider: "Other",
    environment: "Production",
    notes: "",
    tags: "",
  });

  const [pemKey, setPemKey] = useState<{ key: string; filename: string } | null>(null);
  const [pemUploading, setPemUploading] = useState(false);
  const [sshTesting, setSSHTesting] = useState(false);
  const [sshResult, setSSHResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string | number) => setForm((p) => ({ ...p, [field]: value }));

  const canSave = pemKey && sshResult?.success && form.displayName && form.publicIp && form.username;

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

    if (result.error) { toast(result.error, "error"); }
    else if (result.data) {
      setPemKey({ key: result.data.key, filename: file.name });
      toast("PEM key uploaded securely", "success");
    }
    e.target.value = "";
  };

  // Test SSH
  const handleTestSSH = async () => {
    if (!pemKey || !form.publicIp) return;
    setSSHTesting(true);
    setSSHResult(null);

    const result = await testSSH({
      host: form.publicIp,
      port: form.sshPort,
      username: form.username,
      pemKeyS3Key: pemKey.key,
    });

    setSSHTesting(false);
    if ("error" in result) {
      setSSHResult({ success: false, message: result.error as string });
      toast(result.error as string, "error");
    } else {
      setSSHResult({ success: result.success, message: result.message });
      if (result.success) toast("SSH connection verified", "success");
      else toast(result.message, "error");
    }
  };

  // Save server
  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const tagArray = form.tags.split(",").map((t) => t.trim()).filter(Boolean);

    const result = await createServer({
      displayName: form.displayName,
      publicIp: form.publicIp,
      sshPort: form.sshPort,
      username: form.username,
      pemKeyS3Key: pemKey!.key,
      os: form.os.toLowerCase(),
      provider: form.provider.toLowerCase(),
      environment: form.environment.toLowerCase(),
      notes: form.notes || undefined,
      tags: tagArray,
    });

    setSaving(false);
    if (result.error) toast(result.error, "error");
    else { toast("Server added successfully!", "success"); router.push("/servers"); }
  };

  return (
    <AppShell title="Add Server" subtitle="Connect a new VPS via SSH">
      <div className="max-w-2xl mx-auto space-y-5 animate-fade-in">
        {/* Back */}
        <button onClick={() => router.push("/servers")} className="flex items-center gap-1.5 text-[12px] text-secondary hover:text-foreground transition-colors">
          <ArrowLeft size={13} /> Back to servers
        </button>

        {/* Connection Details */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Server size={15} className="text-primary" />
            <h2 className="text-[14px] font-semibold text-foreground">Connection Details</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Server Name *</label>
              <input value={form.displayName} onChange={(e) => update("displayName", e.target.value)} placeholder="my-production-server"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Public IP *</label>
              <input value={form.publicIp} onChange={(e) => update("publicIp", e.target.value)} placeholder="203.0.113.42"
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted font-mono outline-none focus:border-primary/50 transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Operating System</label>
              <select value={form.os} onChange={(e) => update("os", e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors">
                {OS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Provider</label>
              <select value={form.provider} onChange={(e) => update("provider", e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors">
                {PROVIDER_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted font-medium block mb-1.5">Environment</label>
              <select value={form.environment} onChange={(e) => update("environment", e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors">
                {ENV_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted font-medium block mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Optional notes about this server..." rows={2}
              className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors resize-none" />
          </div>

          <div>
            <label className="text-[10px] text-muted font-medium block mb-1.5">Tags (comma separated)</label>
            <input value={form.tags} onChange={(e) => update("tags", e.target.value)} placeholder="web, api, production"
              className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
          </div>
        </div>

        {/* PEM Upload */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key size={14} className="text-primary" />
              <h3 className="text-[13px] font-semibold text-foreground">PEM Key *</h3>
            </div>
            {pemKey && <span className="text-[10px] text-success flex items-center gap-1"><CheckCircle size={10} /> Uploaded</span>}
          </div>

          {!pemKey ? (
            <button onClick={() => pemInputRef.current?.click()} disabled={pemUploading}
              className="w-full border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/40 transition-colors">
              {pemUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={20} className="animate-spin text-primary" />
                  <p className="text-[11px] text-secondary">Uploading to encrypted storage...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={20} className="text-muted" />
                  <p className="text-[12px] text-foreground font-medium">Upload PEM Key</p>
                  <p className="text-[10px] text-muted">Only .pem and .key files (max 64KB)</p>
                </div>
              )}
            </button>
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
          <input ref={pemInputRef} type="file" accept=".pem,.key" className="hidden" onChange={handlePemUpload} />
        </div>

        {/* SSH Test */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Wifi size={14} className="text-primary" />
            <h3 className="text-[13px] font-semibold text-foreground">SSH Connection Test *</h3>
          </div>
          <p className="text-[11px] text-secondary">Connection must be verified. Server info will be collected automatically.</p>

          <button onClick={handleTestSSH} disabled={sshTesting || !pemKey || !form.publicIp || !form.username}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-medium bg-bg border border-border text-foreground hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            {sshTesting ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
            {sshTesting ? "Connecting..." : "Test SSH Connection"}
          </button>

          {sshResult && (
            <div className={cn("p-3 rounded-xl border flex items-center gap-2",
              sshResult.success ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"
            )}>
              {sshResult.success ? <CheckCircle size={13} className="text-success" /> : <XCircle size={13} className="text-danger" />}
              <p className={cn("text-[12px] font-medium", sshResult.success ? "text-success" : "text-danger")}>{sshResult.message}</p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button onClick={handleSave} disabled={!canSave || saving}
          className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {saving ? "Adding server & collecting info..." : "Save Server"}
        </button>

        {!canSave && (pemKey || form.publicIp) && (
          <p className="text-[10px] text-warning text-center">
            {!pemKey ? "⚠ Upload PEM key" : !sshResult?.success ? "⚠ Pass SSH test first" : "⚠ Fill all required fields"}
          </p>
        )}
      </div>
    </AppShell>
  );
}
