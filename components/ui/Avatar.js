import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

/**
 * Minimalist Modern Avatar — Electric Blue tint.
 */
export default function Avatar({ name, src, size = "md", className }) {
  const sizes = {
    xs: "w-7 h-7 text-[10px]",
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-lg",
  };

  if (src) {
    return (
      <img src={src} alt={name || "Avatar"}
        className={cn("rounded-full object-cover ring-2 ring-white shadow-soft", sizes[size], className)} />
    );
  }

  return (
    <div className={cn(
      "rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-mono font-medium text-[#0052FF]",
      sizes[size], className
    )} title={name}>
      {getInitials(name)}
    </div>
  );
}
