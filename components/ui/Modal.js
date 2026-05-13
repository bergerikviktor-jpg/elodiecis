"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useCallback } from "react";

/**
 * Minimalist Modern Modal — white dialog, blue close hover.
 *
 * Layout-strategi:
 *   - Yttre wrappern är ett fullskärms-flex-overlay med padding (`p-4`).
 *     Padding säkrar att modulen aldrig kletar i kanten.
 *   - Själva modal-rutan är flex-column med `max-h-full` (= max viewport
 *     - p-4 på vardera sida = 100vh - 32px). Den blir aldrig högre än
 *     viewport, så centreringen via `items-center` kan inte klippa
 *     topp/botten.
 *   - Title-baren har `shrink-0` så den syns alltid.
 *   - Content-området är `flex-1 min-h-0 overflow-y-auto` så det fyller
 *     resterande höjd och scrollar internt vid behov.
 *
 *   `min-h-0` är kritisk: utan den ärver flex-childen sin innehållshöjd
 *   och spränger föräldern, vilket återinför topp/botten-klippet vi
 *   precis fixade.
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
        "relative w-full max-h-full flex flex-col rounded-2xl bg-white border border-slate-200 shadow-hover animate-slide-in-up",
        sizes[size], className
      )}>
        {title && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-heading text-slate-900 truncate">{title}</h2>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5 font-mono truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all duration-200 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
