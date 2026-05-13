"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(undefined);

let nextId = 1;

/**
 * App-level toast notifications. Use `useToast()` to push messages from
 * anywhere. Toasts auto-dismiss after `duration` ms (default 4000).
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant, message, duration = 4000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, variant, message }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const value = {
    success: (message, duration) => push("success", message, duration),
    error: (message, duration) => push("error", message, duration),
    info: (message, duration) => push("info", message, duration),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/* ── Toaster surface ─────────────────────────────────────────────── */

import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const variantStyles = {
  success: {
    border: "border-emerald-200",
    bg: "bg-white",
    accent: "bg-emerald-500",
    iconColor: "text-emerald-500",
    Icon: CheckCircle2,
  },
  error: {
    border: "border-red-200",
    bg: "bg-white",
    accent: "bg-red-500",
    iconColor: "text-red-500",
    Icon: AlertCircle,
  },
  info: {
    border: "border-blue-200",
    bg: "bg-white",
    accent: "bg-[#0052FF]",
    iconColor: "text-[#0052FF]",
    Icon: Info,
  },
};

function Toaster({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2.5 pointer-events-none">
      {toasts.map((t) => {
        const style = variantStyles[t.variant] || variantStyles.info;
        const { Icon } = style;
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-md rounded-xl border ${style.border} ${style.bg} shadow-hover overflow-hidden animate-slide-in-up`}
          >
            <div className={`w-1 self-stretch ${style.accent}`} />
            <div className="flex items-start gap-3 py-3 pr-3 flex-1">
              <Icon className={`w-5 h-5 ${style.iconColor} shrink-0 mt-0.5`} />
              <p className="text-sm text-slate-700 font-body leading-snug flex-1">
                {t.message}
              </p>
              <button
                onClick={() => onDismiss(t.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-0.5 -mt-0.5 -mr-0.5"
                aria-label="Stäng notifiering"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
