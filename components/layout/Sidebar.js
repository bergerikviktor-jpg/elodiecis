"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Kanban, FolderKanban, Files, StickyNote, UsersRound, Settings, KanbanSquare, ChevronLeft, ChevronRight, Clapperboard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/lib/useUserProfile";
import Avatar from "@/components/ui/Avatar";
import { useState } from "react";

const navItems = [
  { label: "Översikt", href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline", href: "/pipeline", icon: Kanban },
  { label: "Kunder", href: "/clients", icon: Users },
  { label: "Projekt", href: "/projects", icon: FolderKanban },
  { label: "Uppgiftstavla", href: "/todolist", icon: KanbanSquare },
  { label: "Team", href: "/team", icon: UsersRound },
];

// Pinned at the bottom of the sidebar — personal & utility links,
// visually separated from the main feature nav.
const bottomNavItems = [
  { label: "Mina anteckningar", href: "/notes", icon: StickyNote },
  { label: "Mina filer", href: "/files", icon: Files },
  { label: "Inställningar", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { userProfile: authProfile, signOut } = useAuth();
  // Live Firestore profile — drives displayName + photoURL updates without
  // needing a re-login. Falls back to the auth-derived profile while the
  // Firestore doc is still loading on first mount.
  const { profile: firestoreProfile } = useUserProfile();
  const profile = firestoreProfile || authProfile;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "fixed top-0 left-0 z-40 h-screen flex flex-col bg-[#0F172A] border-r border-white/8 transition-all duration-300",
      collapsed ? "w-[72px]" : "w-[260px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/8 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center shrink-0 shadow-glow">
          <Clapperboard className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in">
            <h1 className="text-xl font-body font-bold text-white tracking-tight">ElodieCIS</h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest leading-none">Produktionssvit</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono transition-all duration-200",
                isActive
                  ? "bg-[#0052FF]/10 text-[#4D7CFF] border border-[#0052FF]/30 shadow-glow"
                  : "text-slate-500 hover:bg-white/5 hover:text-white border border-transparent",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Pinned bottom nav — Settings etc. Sits above the collapse button
          with a top divider so it visually anchors to the footer. */}
      <div className="pt-2 mt-1 border-t border-white/8 px-3 space-y-1 shrink-0">
        {bottomNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono transition-all duration-200",
                isActive
                  ? "bg-[#0052FF]/10 text-[#4D7CFF] border border-[#0052FF]/30 shadow-glow"
                  : "text-slate-500 hover:bg-white/5 hover:text-white border border-transparent",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mt-2 mb-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:text-[#4D7CFF] hover:bg-white/5 transition-all duration-200 text-xs font-mono">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Minimera</span></>}
      </button>

      {/* User */}
      <div className={cn("border-t border-white/8 p-3 shrink-0", collapsed ? "flex justify-center" : "")}>
        <div className={cn("flex items-center gap-3", collapsed && "flex-col gap-2")}>
          <Avatar
            name={profile?.displayName || profile?.fullName}
            src={profile?.photoURL}
            size="sm"
            className="shrink-0"
          />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body font-semibold text-white truncate">
                {profile?.displayName || profile?.fullName || "Användare"}
              </p>
              <p className="text-[11px] text-slate-500 truncate font-mono">{profile?.email}</p>
            </div>
          )}
          <button onClick={signOut} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Logga ut">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
