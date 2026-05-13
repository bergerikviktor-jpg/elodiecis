"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Download, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Fullscreen image preview overlay. Used when the user clicks an
 * inline image bubble in a chat. Closes on backdrop click + ESC.
 *
 * Download via blob fetch: Firebase Storage URLs are cross-origin,
 * so the bare `<a download>` attribute is ignored by browsers — they
 * open the image in a tab instead. Fetching as a blob and creating
 * an object URL forces an actual file download.
 */
export default function ImageLightbox({ image, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // ESC to close
  useEffect(() => {
    if (!image) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [image, onClose]);

  const handleDownload = useCallback(async () => {
    if (!image?.url) return;
    setDownloading(true);
    setError("");
    try {
      const res = await fetch(image.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = image.name || "bild";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("download failed", err);
      setError("Kunde inte ladda ner bilden. Höger-klicka istället.");
    } finally {
      setDownloading(false);
    }
  }, [image]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Bildförhandsvisning"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Top bar — filename + actions */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 gap-4 pointer-events-none">
        <div className="min-w-0 flex-1 pointer-events-auto">
          {image.name && (
            <p className="text-sm font-body font-medium text-white/90 truncate drop-shadow">
              {image.name}
            </p>
          )}
          {image.size != null && (
            <p className="text-xs text-white/60 font-mono mt-0.5">
              {formatBytes(image.size)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono",
              "bg-white/10 text-white border border-white/15 backdrop-blur-md",
              "hover:bg-white/20 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label="Ladda ner bild"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Ladda ner</span>
          </button>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-mono bg-white/10 text-white border border-white/15 backdrop-blur-md hover:bg-white/20 transition-colors"
            aria-label="Öppna i ny flik"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-white border border-white/15 backdrop-blur-md hover:bg-white/20 transition-colors"
            aria-label="Stäng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* The image itself. Right-click works natively → "Save image as". */}
      <div className="relative z-0 max-w-full max-h-full">
        <img
          src={image.url}
          alt={image.name || "Förhandsvisning"}
          className="max-w-full max-h-[88vh] rounded-2xl shadow-hover object-contain animate-slide-in-up"
        />
      </div>

      {error && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 rounded-xl bg-red-500/95 text-white px-4 py-2 text-xs font-mono shadow">
          {error}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
