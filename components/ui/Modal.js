"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useCallback } from "react";

/**
 * Minimalist Modern Modal — white dialog, blue close hover.
 *
 * Layout-strategi:
 *   - Yttre wrappern är ett fullskärms-flex-overlay med padding (`p-4`).
 *   - Modal-rutan sizar sig till content height, men content-området
 *     är hårt kapat med max-h så modulen aldrig blir högre än viewport
 *     (med marginal för title-bar och padding).
 *
 *     `max-h-[calc(100dvh-9rem)]` på content-området är medvetet vald:
 *       100dvh = dynamic viewport, hanterar mobil-browser-chrome korrekt
 *       9rem (144px) reserveras för title-bar (~80px) + outer p-4
 *       (32px) + buffer (32px) så title aldrig klipps.
 *
 *     Tidigare hade vi `flex-1 min-h-0 overflow-y-auto` här, men den
 *     kombinationen har en känd CSS-quirk där flex-childen inte växer
 *     när föräldern saknar fixerad höjd. Den nuvarande explicit-max-h
 *     är förutsägbar i alla browsers.
 */
export default function Modal({ isOpen, onClose, title, subtitle, children, size = "md", className }) {
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl", full: "max-w-[90vw]" };

  const handleEscape = useCallback((e) => { if (e.key === "Escape") onClose?.(); }, [onClose]);

  useEffect(() => {
    if (isOpen) { document.addEventListener("keydown", handleEscape); document.body.style.overflow = "hidden"; }
    return () => { document.removeEventListener("keydown", handleEscape); document.body.style.overflow = ""; };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={cn(
        "relative w-full rounded-2xl bg-white border border-slate-200 shadow-hover animate-slide-in-up overflow-hidden",
        sizes[size], className
      )}>
        {title && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200">
            <div className="min-w-0">
              <h2 className="text-lg font-heading text-slate-900 truncate">{title}</h2>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5 font-mono truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all duration-200 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-6 py-4 max-h-[calc(100dvh-9rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
