"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useCallback } from "react";

/**
 * Minimalist Modern Modal — white dialog, blue close hover.
 *
 * Layout-strategi:
 *   - Yttre overlay = `fixed inset-0 overflow-y-auto` — hela vyn är
 *     scrollbar. Det betyder att hur lång modulen än är klipps den
 *     ALDRIG; istället scrollar man hela overlay-viewporten.
 *   - Inner-wrappern är `min-h-full flex items-center justify-center`:
 *       * För korta moduler → centreras snyggt i viewporten.
 *       * För långa moduler → överskrider min-h-full, overlayn scrollar
 *         vertikalt och man når hela modulen genom att skrolla.
 *   - Modal-rutan har inga max-h-grepp — den sizar sig till content.
 *     Backgrunden får sin "tone" från overlay-divens egna bg-slate-900/30.
 *
 *   Click-to-close: hela overlayn fångar klick + close, men inner-modul
 *   stop-propagerar så klick inne i formuläret inte stänger den.
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
    // Yttre overlay: hela viewport, klickbar bakgrund + scrollbar.
    // När modulen är högre än viewport scrollas hela overlayn vertikalt
    // i stället för att klippa modulen. min-h-full + items-center på
    // inner-wrappern gör att korta moduler ändå centreras snyggt.
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative w-full rounded-2xl bg-white border border-slate-200 shadow-hover animate-slide-in-up overflow-hidden",
            sizes[size], className
          )}
        >
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
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
