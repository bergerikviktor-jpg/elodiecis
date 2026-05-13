import { cn } from "@/lib/utils";

/**
 * Light Badge — soft colored backgrounds, monospace font retained.
 */
export default function Badge({ children, color, variant = "default", size = "sm", className }) {
  const sizes = {
    xs: "px-2 py-0.5 text-[10px]",
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-xs",
  };

  const colorMap = {
    "#6366f1": { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    "#8b5cf6": { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
    "#a855f7": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
    "#f59e0b": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    "#f97316": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
    "#22c55e": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    "#ef4444": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
    "#3b82f6": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    "#64748b": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
    "#52525b": { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200" },
  };

  const mapped = colorMap[color] || { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" };

  if (variant === "dot") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-mono font-medium text-slate-500", className)}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ backgroundColor: color }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        </span>
        {children}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center font-mono font-medium rounded-full border", mapped.bg, mapped.text, mapped.border, sizes[size], className)}>
      {children}
    </span>
  );
}
