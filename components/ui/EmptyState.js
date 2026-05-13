"use client";

import { cn } from "@/lib/utils";

/**
 * Minimalist Modern EmptyState — blue icon container.
 */
export default function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 px-6 text-center", className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center mb-5 shadow-glow">
          <Icon className="w-7 h-7 text-white" />
        </div>
      )}
      <h3 className="text-base font-heading text-slate-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  );
}
