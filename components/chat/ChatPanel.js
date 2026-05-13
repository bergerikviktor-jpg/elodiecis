"use client";

import { useMemo, useState } from "react";
import { Search, Plus, MessageSquare, Users } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useUserProfiles } from "@/lib/useChatData";
import { presenceLabel } from "@/lib/usePresence";
import { cn } from "@/lib/utils";

/**
 * Floating chat panel — opens above the ChatBubble. Shows the user's
 * conversation list with realtime unread counts + presence indicators,
 * a search field, and a "Ny chatt"-button that opens NewChatModal.
 *
 * Clicking a conversation opens its popup (and auto-closes the panel
 * — see ChatContext.openConversation).
 */
export default function ChatPanel() {
  const { user } = useAuth();
  const {
    panelOpen,
    conversations,
    conversationsLoading,
    openConversation,
    openNewChat,
  } = useChat();

  const [search, setSearch] = useState("");

  // Resolve every other-participant's profile so we can show names + avatars.
  const otherUids = useMemo(() => {
    if (!user) return [];
    const set = new Set();
    conversations.forEach((c) => {
      (c.participants || []).forEach((u) => {
        if (u !== user.uid) set.add(u);
      });
    });
    return Array.from(set);
  }, [user, conversations]);
  const { profiles } = useUserProfiles(otherUids);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      // Group: match on groupName
      if (c.type === "group") {
        return (c.groupName || "").toLowerCase().includes(q);
      }
      // Private: match on the other user's displayName or email
      const otherUid = c.participants?.find((u) => u !== user?.uid);
      const profile = profiles.get(otherUid);
      const name = (profile?.displayName || "").toLowerCase();
      const email = (profile?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [conversations, profiles, search, user]);

  if (!panelOpen) return null;

  return (
    <div
      className={cn(
        "fixed bottom-24 right-6 z-50",
        "w-[360px] max-h-[600px] flex flex-col",
        "rounded-2xl border border-slate-200 shadow-hover overflow-hidden",
        "bg-white/95 backdrop-blur-xl",
        "animate-slide-in-up"
      )}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-heading text-slate-900 tracking-tight">
            Meddelanden
          </h2>
          <button
            type="button"
            onClick={openNewChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white text-xs font-mono font-medium hover:brightness-110 active:scale-95 shadow-glow transition-all"
            aria-label="Ny chatt"
          >
            <Plus className="w-3.5 h-3.5" />
            Ny chatt
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök konversationer..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
          />
        </div>
      </div>

      {/* Body — conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversationsLoading ? (
          <ListSkeleton />
        ) : conversations.length === 0 ? (
          <EmptyPanel onNewChat={openNewChat} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Search className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-sm font-mono text-slate-500">
              Inga träffar för &quot;{search.trim()}&quot;.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                myUid={user?.uid}
                profiles={profiles}
                onOpen={() => openConversation(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   ConversationRow
   ────────────────────────────────────────────────────────────────── */

function ConversationRow({ conversation: c, myUid, profiles, onOpen }) {
  const isGroup = c.type === "group";

  // Resolve display data based on conv type.
  let displayName, photoURL, presence;
  if (isGroup) {
    displayName = c.groupName || "Gruppchatt";
    photoURL = c.groupPhoto || null;
    presence = null;
  } else {
    const otherUid = c.participants?.find((u) => u !== myUid);
    const profile = profiles.get(otherUid);
    displayName = profile?.displayName || "Laddar...";
    photoURL = profile?.photoURL || null;
    presence = profile ? presenceLabel(profile) : null;
  }

  const unread = c.unreadCounts?.[myUid] || 0;
  const last = c.lastMessage;
  const lastIsMine = last?.senderUid === myUid;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left px-4 py-3 hover:bg-slate-50/70 transition-colors group flex items-center gap-3"
    >
      <div className="relative shrink-0">
        {isGroup ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center text-white shadow-glow">
            <Users className="w-5 h-5" />
          </div>
        ) : (
          <Avatar name={displayName} src={photoURL} size="md" />
        )}
        {presence && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
            style={{ backgroundColor: presence.dotColor }}
            title={presence.label}
          />
        )}
      </div>

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
            {displayName}
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
            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-[#0052FF] text-white text-[10px] font-mono font-semibold flex items-center justify-center shrink-0">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyPanel({ onNewChat }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center mb-4 shadow-glow">
        <MessageSquare className="w-5 h-5 text-white" />
      </div>
      <p className="text-sm font-body font-semibold text-slate-900 mb-1">
        Inga konversationer än
      </p>
      <p className="text-xs text-slate-500 font-mono leading-relaxed mb-4 max-w-[260px]">
        Starta en privatchatt eller skapa en grupp för att börja.
      </p>
      <button
        type="button"
        onClick={onNewChat}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white text-xs font-mono font-medium hover:brightness-110 active:scale-95 shadow-glow transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Ny chatt
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
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
