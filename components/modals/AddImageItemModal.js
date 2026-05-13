"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { createImageItem, uploadBoardImage } from "@/lib/boardItems";

/**
 * Pick a local image → upload to Storage → create a board item at
 * the supplied spawn position. We read the file's natural dimensions
 * before upload so the item is created with the right aspect ratio.
 */
export default function AddImageItemModal({
  isOpen,
  onClose,
  teamId,
  projectId,
  spawnPosition, // { x, y, z } where to place the new item
}) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [naturalDims, setNaturalDims] = useState(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewUrl(null);
      setNaturalDims(null);
      setProgress(0);
      setSubmitting(false);
      setError("");
    }
  }, [isOpen]);

  // Generate object URL for preview, free on cleanup
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Read natural dimensions
    const img = new Image();
    img.onload = () => {
      setNaturalDims({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => setNaturalDims(null);
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Filen måste vara en bild.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("Bilden får max vara 8 MB.");
      return;
    }
    setError("");
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !user || !teamId || !projectId) return;
    setSubmitting(true);
    setError("");
    try {
      const uploaded = await uploadBoardImage(teamId, projectId, file, {
        onProgress: setProgress,
      });
      await createImageItem(teamId, projectId, user.uid, {
        x: spawnPosition?.x ?? 100,
        y: spawnPosition?.y ?? 100,
        z: spawnPosition?.z ?? 1,
        src: uploaded.url,
        storagePath: uploaded.path,
        filename: uploaded.filename,
        naturalWidth: naturalDims?.width,
        naturalHeight: naturalDims?.height,
      });
      toast.success("Bild tillagd på board.");
      onClose?.();
    } catch (err) {
      console.error("createImageItem failed", err?.code, err?.message);
      setError(err.message || "Kunde inte lägga till bild.");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Lägg till bild" subtitle="// board.image()">
      <div className="space-y-4">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={submitting}
          className="hidden"
        />

        {previewUrl ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
            <img
              src={previewUrl}
              alt="Förhandsvisning"
              className="w-full max-h-72 object-contain bg-white"
            />
            <div className="px-4 py-2 flex items-center justify-between border-t border-slate-200">
              <p className="text-xs font-mono text-slate-600 truncate">
                {file.name}
                {naturalDims && (
                  <span className="text-slate-400 ml-2">
                    {naturalDims.width}×{naturalDims.height} px
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={() => setFile(null)}
                disabled={submitting}
                className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 px-4 py-10 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-[#0052FF]/50 hover:text-[#0052FF] hover:bg-blue-50/50 transition-all duration-200"
          >
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm font-mono">Välj bild från datorn</span>
            <span className="text-[10px] font-mono text-slate-400">
              JPG / PNG / WebP · max 8 MB
            </span>
          </button>
        )}

        {submitting && progress > 0 && progress < 100 && (
          <div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-1">
              Laddar upp... {progress}%
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            icon={Upload}
            onClick={handleSubmit}
            loading={submitting}
            disabled={!file}
          >
            Lägg till på board
          </Button>
        </div>
      </div>
    </Modal>
  );
}
