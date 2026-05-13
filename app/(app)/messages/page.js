"use client";

import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { fetchUserProfiles } from "@/lib/friends";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

export default function MessagesPage() {
  const { user } = useAuth();
  const { conversations, conversationsLoading, openConversation } = useChat();
  const [profiles, setProfiles] = useState(new Map());
  const [search, setSearch] = useState("");

  // Resolve "other party" profiles for every conversation.
  const otherUids = useMemo(() => {
    if (!user) return [];
    const set = new Set();
    conversations.forEach((c) => {
      const other = c.participants?.find((u) => u !== user.uid);
      if (other) set.add(other);
    });
    return Array.from(set);
  }, [user, conversations]);

  useEffect(() => {
    if (otherUids.length === 0) return;
    const missing = otherUids.filter((u) => !profiles.has(u));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchUserProfiles(missing)
      .then((map) => {
        if (cancelled) return;
        setProfiles((prev) => {
          const next = new Map(prev);
          map.forEach((v, k) => next.set(k, v));
          return next;
        });
      })
      .catch((err) => console.error("profile fetch error:", err));
    return () => {
      cancelled = true;
    };
  }, [otherUids, profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const otherUid = c.participants?.find((u) => u !== user?.uid);
      const profile = profiles.get(otherUid);
      const name = (profile?.displayName || "").toLowerCase();
      const email = (profile?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [conversations, profiles, search, user]);

  const totalUnread = useMemo(() => {
    if (!user) return 0;
    return conversations.reduce(
      (sum, c) => sum + (c.unreadCounts?.[user.uid] || 0),
      0
    );
  }, [conversations, user]);

  return (
    <>
      <Header
        title="Meddelanden"
        subtitle={
          conversationsLoading
            ? "// laddar..."
            : `// ${conversations.length} ${conversations.length === 1 ? "konversation" : "konversationer"}${totalUnread > 0 ? ` · ${totalUnread} olästa` : ""}`
        }
      />

      <div className="p-8 max-w-3xl mx-auto animate-fade-in">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök bland konversationer..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 shadow-card focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
          />
        </div>

        {conversationsLoading ? (
          <ListSkeleton />
        ) : conversations.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={MessageSquare}
              title="Inga konversationer än"
              description="Gå till Kollegor och starta en chatt med en vän."
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Search}
              title="Inga träffar"
              description={`Inga konversationer matchar "${search.trim()}".`}
            />
          </Card>
        ) : (
          <Card padding="none">
            <div className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const otherUid = c.participants?.find((u) => u !== user?.uid);
                const profile = profiles.get(otherUid);
                const unread = c.unreadCounts?.[user?.uid] || 0;
                const last = c.lastMessage;
                const lastIsMine = last?.senderUid === user?.uid;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="w-full text-left px-5 py-4 hover:bg-slate-50/70 transition-colors group flex items-center gap-4"
                  >
                    <Avatar
                      name={profile?.displayName}
                      src={profile?.photoURL}
                      size="md"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={cn(
                            "text-sm font-body truncate",
                            unread > 0
                              ? "font-bold text-slate-900"
                              : "font-semibold text-slate-900 group-hover:text-[#0052FF] transition-colors"
                          )}
                        >
                          {profile?.displayName || "Laddar..."}
                        </p>
                        {c.lastMessageAt && (
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {formatShortTime(c.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3 mt-0.5">
                        <p
                          className={cn(
                            "text-xs font-mono truncate",
                            unread > 0 ? "text-slate-700" : "text-slate-500"
                          )}
                        >
                          {last
                            ? `${lastIsMine ? "Du: " : ""}${last.text || ""}`
                            : "Säg hej!"}
                        </p>
                        {unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#0052FF] text-white text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <Card padding="none">
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 rounded bg-slate-200" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatShortTime(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
  }
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString("sv-SE", { weekday: "short" });
  }
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}
