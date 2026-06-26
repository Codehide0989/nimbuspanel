"use client";

import { useState, useRef } from "react";
import { FolderOpen, Upload, Trash2, Download, Search, Loader2, File, Image as ImageIcon, FileText, Archive, Grid, List } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { uploadFile, deleteFileRecord, getDownloadUrl } from "@/actions/files";
import { formatBytes, formatRelativeTime, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface FileItem { id: string; filename: string; category: string; size: number; mimeType: string; createdAt: string; uploaderEmail: string; }
interface Props { files: FileItem[]; }

const categories = ["all", "avatars", "pem-keys", "configs", "backups", "logs"] as const;

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon size={14} className="text-purple" />;
  if (mime.includes("zip") || mime.includes("gzip") || mime.includes("tar")) return <Archive size={14} className="text-warning" />;
  if (mime.includes("json") || mime.includes("yaml")) return <FileText size={14} className="text-primary" />;
  return <File size={14} className="text-secondary" />;
}

export function StorageClient({ files }: Props) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  const filtered = files.filter((f) => {
    if (filter !== "all" && f.category !== filter) return false;
    if (search && !f.filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", filter === "all" ? "configs" : filter);
    const result = await uploadFile(formData);
    setUploading(false);
    if (result.error) toast(result.error, "error");
    else { toast(`${file.name} uploaded`, "success"); router.refresh(); }
    e.target.value = "";
  };

  const handleDelete = async (fileId: string) => {
    setDeleting(fileId);
    const result = await deleteFileRecord(fileId);
    setDeleting(null);
    if (result.error) toast(result.error, "error");
    else { toast("File deleted", "success"); router.refresh(); }
  };

  const handleDownload = async (fileId: string) => {
    const result = await getDownloadUrl(fileId);
    if (result.error) toast(result.error, "error");
    else if (result.data) window.open(result.data.url, "_blank");
  };

  return (
    <AppShell title="Storage" subtitle={`${files.length} files · ${formatBytes(totalSize)}`}>
      <div className="space-y-4 animate-fade-in">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 overflow-x-auto">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all",
                  filter === cat ? "bg-primary/10 text-primary" : "text-muted hover:text-secondary"
                )}>
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-1.5">
              <Search size={11} className="text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..."
                className="bg-transparent border-none outline-none text-[11px] text-foreground placeholder:text-muted w-28" />
            </div>
            <div className="flex items-center bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setView("list")} className={cn("p-1.5 transition-colors", view === "list" ? "text-primary bg-primary/10" : "text-muted")}><List size={13} /></button>
              <button onClick={() => setView("grid")} className={cn("p-1.5 transition-colors", view === "grid" ? "text-primary bg-primary/10" : "text-muted")}><Grid size={13} /></button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-all shadow-lg shadow-primary/10">
              {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        {/* File List */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No files"
              description={files.length === 0 ? "Upload files like PEM keys, configs, and backups." : "No files match your filter."}
              primaryAction={files.length === 0 ? (
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium bg-primary text-white hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">
                  <Upload size={14} /> Upload File
                </button>
              ) : undefined}
            />
          ) : view === "list" ? (
            <div className="divide-y divide-border/30">
              {filtered.map((file) => (
                <div key={file.id} className="flex items-center justify-between px-4 py-3 hover:bg-card-hover/40 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0">
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] text-foreground font-medium truncate">{file.filename}</p>
                      <p className="text-[10px] text-muted">{formatBytes(file.size)} · {file.category} · {formatRelativeTime(file.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDownload(file.id)} className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition-colors" title="Download"><Download size={12} /></button>
                    <button onClick={() => handleDelete(file.id)} disabled={deleting === file.id} className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors" title="Delete">
                      {deleting === file.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
              {filtered.map((file) => (
                <div key={file.id} className="bg-bg border border-border rounded-xl p-3 hover:border-border-hover transition-all group">
                  <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center mb-2">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <p className="text-[11px] text-foreground font-medium truncate">{file.filename}</p>
                  <p className="text-[9px] text-muted mt-0.5">{formatBytes(file.size)}</p>
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDownload(file.id)} className="p-1 rounded text-muted hover:text-primary"><Download size={11} /></button>
                    <button onClick={() => handleDelete(file.id)} className="p-1 rounded text-muted hover:text-danger"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
