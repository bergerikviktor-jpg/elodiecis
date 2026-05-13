"use client";

import { Search, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimalist Modern Header — Electric Blue accents.
 */
export default function Header({ title, subtitle, actions }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const settingsActive =
    pathname === "/settings" || pathname?.startsWith("/settings/");

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-5">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setSearchOpen(!searchOpen)} className="p-2.5 rounded-xl text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all duration-200" title="Sök">
            <Search className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-xl text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all duration-200 relative" title="Aviseringar">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#0052FF] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0052FF]" />
            </span>
          </button>
          <Link
            href="/settings"
            title="Inställningar"
            aria-label="Inställningar"
            className={cn(
              "p-2.5 rounded-xl transition-all duration-200",
              settingsActive
                ? "text-[#0052FF] bg-blue-50"
                : "text-slate-400 hover:text-[#0052FF] hover:bg-blue-50"
            )}
          >
            <Settings
              className={cn(
                "w-5 h-5 transition-transform duration-300",
                "hover:rotate-45"
              )}
            />
          </Link>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-heading text-slate-900 tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5 font-mono">{subtitle}</p>}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
      {searchOpen && (
        <div className="mt-4 animate-slide-in-up">
          <input type="text" placeholder="Sök kunder, affärer, projekt..." autoFocus
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 font-body focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
            onBlur={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
