"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Upload, ImageIcon, Trash2 } from "lucide-react";
import { uploadAvatar, removeAvatar } from "@/lib/account";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const MAX_BYTES = 5 * 1024 * 1024;

export default function AvatarUploadModal({ isOpen, onClose, profile }) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  // Free the object URL when the file changes (or modal closes).
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setFile(null);
    setError("");
    setProgress(0);
    setUploading(false);
    setRemoving(false);
  };

  const close = () => {
    if (uploading || removing) return;
    reset();
    onClose?.();
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Filen måste vara en bild.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Filen får max vara 5 MB.");
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    setError("");
    setProgress(0);
    try {
      await uploadAvatar(user.uid, file, setProgress);
      toast.success("Profilbilden har uppdaterats.");
      reset();
      onClose?.();
    } catch (err) {
      console.error("uploadAvatar failed", err?.code, err?.message);
      setError(err.message || "Kunde inte ladda upp bilden.");
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    setRemoving(true);
    setError("");
    try {
      await removeAvatar(user.uid);
      toast.info("Profilbilden har tagits bort.");
      reset();
      onClose?.();
    } catch (err) {
      console.error("removeAvatar failed", err?.code, err?.message);
      setError(err.message || "Kunde inte ta bort bilden.");
      setRemoving(false);
    }
  };

  const hasExisting = !!profile?.photoURL;
  const busy = uploading || removing;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Profilbild"
      subtitle="// avatar.upload()"
    >
      <div className="space-y-5">
        {/* Preview */}
        <div className="flex flex-col items-center gap-3 py-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Förhandsgranskning"
              className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-card border border-slate-200"
            />
          ) : (
            <Avatar
              name={profile?.displayName}
              src={profile?.photoURL}
              size="xl"
              className="w-28 h-28 text-2xl"
            />
          )}
          <p className="text-xs text-slate-500 font-mono">
            {file
              ? file.name
              : hasExisting
              ? "Nuvarande profilbild"
              : "Ingen bild uppladdad"}
          </p>
        </div>

        {/* File picker */}
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={busy}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm font-mono text-slate-600 hover:border-[#0052FF]/50 hover:text-[#0052FF] hover:bg-blue-50/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ImageIcon className="w-4 h-4" />
            {file ? "Välj annan bild" : "Välj bild från datorn"}
          </button>
          <p className="text-[10px] text-slate-400 font-mono mt-2 text-center">
            JPG, PNG eller WebP · max 5 MB
          </p>
        </div>

        {/* Progress bar */}
        {uploading && (
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">
              <span>Laddar upp...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {hasExisting && !file ? (
            <Button
              variant="ghost"
              icon={Trash2}
              loading={removing}
              disabled={uploading}
              onClick={handleRemove}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Ta bort
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={close} disabled={busy}>
              Avbryt
            </Button>
            <Button
              icon={Upload}
              loading={uploading}
              disabled={!file || busy}
              onClick={handleUpload}
            >
              Ladda upp
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
