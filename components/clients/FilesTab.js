"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useClientFiles } from "@/lib/useClientsData";
import { uploadClientFile, deleteClientFile } from "@/lib/clients";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024;

export default function FilesTab({ client, teamId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { files, loading } = useClientFiles(teamId, client.id);

  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (fileList) => {
    if (!user) return;
    const fs = Array.from(fileList || []);
    if (fs.length === 0) return;

    setUploading(true);
    let okCount = 0;
    for (const f of fs) {
      try {
        await uploadClientFile(teamId, client.id, f, user.uid);
        okCount += 1;
      } catch (err) {
        console.error("uploadClientFile failed", err);
        toast.error(`${f.name}: ${err.message || "Misslyckades"}`);
      }
    }
    setUploading(false);
    if (okCount > 0) {
      toast.success(`${okCount} ${okCount === 1 ? "fil uppladdad" : "filer uppladdade"}.`);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (file) => {
    if (!user) return;
    if (!window.confirm(`Ta bort "${file.originalName || file.name}"?`)) return;
    try {
      await deleteClientFile(teamId, client.id, file.id, file.storagePath, user.uid);
      toast.success("Fil borttagen.");
    } catch (err) {
      console.error("deleteClientFile failed", err);
      toast.error(err.message || "Kunde inte ta bort.");
    }
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-body font-bold text-slate-900">
          Filer
          <span className="ml-2 text-xs font-mono font-normal text-slate-400">
            {files.length} {files.length === 1 ? "fil" : "filer"}
          </span>
        </h3>
        <Button
          icon={Upload}
          size="sm"
          onClick={() => inputRef.current?.click()}
          loading={uploading}
        >
          Ladda upp
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Drop-zone (alltid synlig — vägleder uppladdning) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 cursor-pointer",
          dragOver
            ? "border-[#0052FF] bg-blue-50"
            : "border-slate-200 hover:border-[#0052FF]/40 hover:bg-slate-50"
        )}
      >
        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 font-body">
          Dra hit filer eller klicka för att välja
        </p>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Max 10 MB · bild, PDF, Office, text
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-[#0052FF] animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={FolderOpen}
            title="Inga filer än"
            description="Spara avtal, beställningar, briefer eller andra dokument tillsammans med kunden."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {files.map((f) => (
            <FileCard key={f.id} file={f} onDelete={() => handleDelete(f)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   FileCard
   ────────────────────────────────────────────────────────────────── */

function FileCard({ file, onDelete }) {
  const Icon = iconForMime(file.mimeType);
  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#0052FF]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-body font-semibold text-slate-900 truncate">
            {file.originalName || file.name}
          </p>
          <p className="text-xs text-slate-500 font-mono">
            {formatBytes(file.size || 0)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <span className="text-[10px] text-slate-400 font-mono">
          {formatRelativeTime(file.uploadedAt)}
        </span>
        <div className="flex items-center gap-1">
          {file.downloadURL && (
            <a
              href={file.downloadURL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
              title="Ladda ner"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Ta bort"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}

function iconForMime(mime) {
  if (!mime) return FileIcon;
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  if (mime.startsWith("text/")) return FileText;
  if (mime.includes("word") || mime.includes("document")) return FileText;
  if (mime.includes("sheet") || mime.includes("excel")) return FileText;
  return FileIcon;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
