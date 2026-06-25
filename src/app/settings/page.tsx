"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Settings, Shield, Globe, Bell, Palette, Key, Save } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Key },
    { id: "danger", label: "Danger Zone", icon: Shield },
  ];

  return (
    <AppShell title="Settings" subtitle="Workspace configuration">
      <div className="max-w-3xl animate-fade-in">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 mb-5 w-fit">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
                activeTab === tab.id ? "bg-primary/10 text-primary" : "text-muted hover:text-secondary")}>
              <tab.icon size={12} /> {tab.label}
            </button>
          ))}
        </div>

        {/* General */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-foreground">Workspace</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted font-medium block mb-1.5">Workspace Name</label>
                  <input defaultValue="" placeholder="My Workspace"
                    className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-primary/50 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-muted font-medium block mb-1.5">Default Region</label>
                  <select className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors">
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted font-medium block mb-1.5">Timezone</label>
                <select className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 transition-colors">
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Asia/Tokyo">Asia/Tokyo</option>
                </select>
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-medium bg-primary text-white hover:bg-primary-hover transition-all">
                <Save size={12} /> Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeTab === "notifications" && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-[13px] font-semibold text-foreground">Notification Preferences</h3>
            {[
              { label: "Server status changes", desc: "When instances start, stop, or fail" },
              { label: "Team updates", desc: "When users join or leave" },
              { label: "File uploads", desc: "When files are uploaded to storage" },
              { label: "Security alerts", desc: "Unusual access patterns or failed auth" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-[12px] text-foreground font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted">{item.desc}</p>
                </div>
                <button className="w-9 h-5 rounded-full bg-primary/20 border border-primary/30 relative transition-all">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-primary transition-all" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Security */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-foreground">AWS Credentials</h3>
              <p className="text-[11px] text-secondary">Credentials are stored as environment variables on the server and never exposed to the browser.</p>
              <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                <p className="text-[11px] text-success font-medium">✓ AWS credentials configured</p>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="text-[13px] font-semibold text-foreground">API Keys</h3>
              <p className="text-[11px] text-secondary">Manage API keys for programmatic access to NimbusPanel.</p>
              <button className="px-3.5 py-2 rounded-xl text-[11px] font-medium bg-card border border-border text-foreground hover:bg-card-hover transition-all">
                Generate API Key
              </button>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {activeTab === "danger" && (
          <div className="bg-card border border-danger/20 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-danger" />
              <h3 className="text-[13px] font-semibold text-danger">Danger Zone</h3>
            </div>
            <p className="text-[11px] text-secondary">These actions are destructive and cannot be undone.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div>
                  <p className="text-[12px] text-foreground font-medium">Delete all VPS records</p>
                  <p className="text-[10px] text-muted">Remove all instances from this workspace</p>
                </div>
                <button className="px-3 py-1.5 rounded-xl text-[11px] font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors">
                  Delete Records
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border">
                <div>
                  <p className="text-[12px] text-foreground font-medium">Delete workspace</p>
                  <p className="text-[10px] text-muted">Permanently delete everything</p>
                </div>
                <button className="px-3 py-1.5 rounded-xl text-[11px] font-medium border border-danger/30 text-danger hover:bg-danger/10 transition-colors">
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
