import { cn } from "@/lib/utils";

/**
 * Minimalist Modern Button — Electric Blue gradient primary.
 */
export default function Button({
  children, variant = "primary", size = "md", icon: Icon,
  iconPosition = "left", className, disabled, loading, ...props
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white font-semibold uppercase tracking-wider shadow-button hover:-translate-y-0.5 hover:shadow-glow-intense hover:brightness-110",
    secondary:
      "bg-white text-slate-700 border border-slate-200 shadow-soft hover:bg-slate-50 hover:border-[#0052FF]/30 hover:-translate-y-0.5 hover:shadow-card",
    ghost:
      "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-[#0052FF]",
    danger:
      "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.3)] hover:-translate-y-0.5",
  };

  const sizes = {
    sm: "px-4 py-2 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3.5 text-sm gap-2",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl transition-all duration-200",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        "active:scale-[0.98]",
        variants[variant], sizes[size], className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className="w-4 h-4" />}
          {children}
          {Icon && iconPosition === "right" && <Icon className="w-4 h-4" />}
        </>
      )}
    </button>
  );
}
