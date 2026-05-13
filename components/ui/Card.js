import { cn } from "@/lib/utils";

/**
 * Minimalist Modern Card — white surface, subtle shadow, blue accent hover.
 */
export default function Card({ children, className, padding = "md", hover = false, glass = false, featured = false, onClick, ...props }) {
  const paddings = { none: "", sm: "p-4", md: "p-6", lg: "p-8" };

  if (featured) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-[#0052FF] via-[#4D7CFF] to-[#0052FF] p-[2px]">
        <div
          className={cn(
            "h-full w-full rounded-[calc(16px-2px)] bg-white",
            paddings[padding],
            hover && "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-hover",
            className
          )}
          onClick={onClick}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border",
        glass ? "bg-white/70 backdrop-blur-sm border-slate-200/80" : "bg-white border-slate-200",
        "shadow-card",
        paddings[padding],
        hover && "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-hover hover:border-[#0052FF]/20",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {/* Gradient overlay on hover */}
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)}>
      <div>
        <h3 className="text-sm font-heading text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-mono">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
