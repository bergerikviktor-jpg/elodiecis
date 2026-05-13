"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Minimalist Modern FormFields — blue focus rings.
 */
export function Input({ label, error, className, inputClassName, ...props }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">{label}</label>}
      <input className={cn(
        "w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 font-body",
        "focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20",
        "transition-all duration-200",
        error && "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/20",
        inputClassName
      )} {...props} />
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
    </div>
  );
}

/**
 * PasswordInput — same look as Input, but with a press-and-hold reveal toggle.
 *
 * Holding the eye icon (mouse, touch, or pen) flips the field to plaintext;
 * releasing — or letting the pointer slide off — flips it back. This is safer
 * than click-to-toggle: the value can't be left visible by accident.
 *
 * The eye button is `tabIndex={-1}` so it doesn't disrupt the form's tab order.
 */
export function PasswordInput({ label, error, className, inputClassName, ...props }) {
  const [revealed, setRevealed] = useState(false);

  const reveal = (e) => {
    // Don't steal focus from the input on pointer-down.
    e.preventDefault();
    setRevealed(true);
  };
  const hide = () => setRevealed(false);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={revealed ? "text" : "password"}
          className={cn(
            "w-full px-4 py-3 pr-12 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 font-body",
            "focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20",
            "transition-all duration-200",
            error && "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/20",
            inputClassName
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={revealed ? "Dölj lösenord" : "Visa lösenord (håll inne)"}
          aria-pressed={revealed}
          onPointerDown={reveal}
          onPointerUp={hide}
          onPointerLeave={hide}
          onPointerCancel={hide}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors cursor-pointer select-none touch-none"
        >
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
    </div>
  );
}

export function Textarea({ label, error, className, ...props }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">{label}</label>}
      <textarea className={cn(
        "w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 font-body resize-none",
        "focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20",
        "transition-all duration-200",
        error && "border-red-300"
      )} rows={3} {...props} />
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
    </div>
  );
}

export function Select({ label, options, error, className, placeholder, ...props }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">{label}</label>}
      <select className={cn(
        "w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 font-body",
        "focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20",
        "transition-all duration-200 appearance-none",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
        error && "border-red-300"
      )} {...props}>
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options?.map((opt) => <option key={opt.value ?? opt} value={opt.value ?? opt}>{opt.label ?? opt}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
    </div>
  );
}
