"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Modern toggle switch. The `onChange` handler may be async — while
 * pending, the toggle disables itself to prevent double-clicks.
 */
export default function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  comingSoon = false,
}) {
  const [pending, setPending] = useState(false);
  const isDisabled = disabled || pending || comingSoon;

  const handleToggle = async () => {
    if (isDisabled) return;
    setPending(true);
    try {
      await Promise.resolve(onChange?.(!checked));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-body font-medium text-slate-900">{label}</p>
          {comingSoon && (
            <span className="text-[9px] font-mono uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              Kommer snart
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 font-mono mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={isDisabled}
        onClick={handleToggle}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 mt-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]/30 focus-visible:ring-offset-2",
          checked ? "bg-[#0052FF]" : "bg-slate-200",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}
