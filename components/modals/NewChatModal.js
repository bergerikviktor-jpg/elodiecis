"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, MessageSquare, Search, Check } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { conversationIdFor, createGroupConversation } from "@/lib/chat";
import { fetchUserProfiles } from "@/lib/friends";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

/**
 * Two-mode chat creation modal:
 *   - "private" → pick one friend → openConversation
 *   - "group"   → pick multiple friends + name → createGroupConversation
 *                 → openConversation(newId)
 *
 * Friend list is read from `friendships` collection (realtime), with
 * profile data resolved via useUserProfiles. We don't subscribe to
 * each friend's profile separately — fetched once on mount via the
 * hook's deduped cache.
 */
export default function NewChatModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const { openConversation } = useChat();

  const [mode, setMode] = useState("private"); // "private" | "group"
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [groupName, setGroupName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to my friendships → derive list of friend uids.
  const [friendUids, setFriendUids] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  useEffect(() => {
    if (!user || !isOpen) return;
    setFriendsLoading(true);
    const q = query(
      collection(db, "friendships"),
      where("users", "array-contains", user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const uids = new Set();
        snap.docs.forEach((d) => {
          const users = d.data().users || [];
          users.forEach((u) => u !== user.uid && uids.add(u));
        });
        setFriendUids(Array.from(uids));
        setFriendsLoading(false);
      },
      (err) => {
        console.error("friendships listener error:", err?.code, err?.message);
        setFriendsLoading(false);
      }
    );
    return () => unsub();
  }, [user, isOpen]);

  const { profiles } = useUserProfiles(friendUids);

  // Reset state when modal opens or closes.
  useEffect(() => {
    if (!isOpen) {
      setMode("private");
      setSearch("");
      setSelected(new Set());
      setGroupName("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const switchMode = (next) => {
    if (submitting) return;
    setMode(next);
    setSelected(new Set());
    setGroupName("");
  };

  const toggleSelect = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else if (mode === "private") {
        // Private = single selection
        next.clear();
        next.add(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  // Build sorted, filtered friend list.
  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = friendUids
      .map((uid) => profiles.get(uid))
      .filter(Boolean)
      .sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "", "sv")
      );
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.displayName || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [friendUids, profiles, search]);

  /* ── Submit ──────────────────────────────────────────────────── */

  const canSubmit = useMemo(() => {
    if (selected.size === 0) return false;
    if (mode === "private") return selected.size === 1;
    return selected.size >= 1 && groupName.trim().length > 0;
  }, [selected, mode, groupName]);

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === "private") {
        const [otherUid] = Array.from(selected);
        const convId = conversationIdFor(user.uid, otherUid);
        openConversation(convId);
        onClose?.();
      } else {
        const convId = await createGroupConversation(
          user.uid,
          groupName.trim(),
          Array.from(selected)
        );
        toast.success(`Gruppen "${groupName.trim()}" skapades.`);
        openConversation(convId);
        onClose?.();
      }
    } catch (err) {
      console.error("new chat failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte starta chatten.");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Ny chatt" subtitle="// conversation.start()">
      <div className="space-y-5">
        {/* Mode toggle */}
        <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => switchMode("private")}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5",
              mode === "private"
                ? "bg-white text-[#0052FF] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Privat
          </button>
          <button
            type="button"
            onClick={() => switchMode("group")}
            className={cn(
              "flex-1 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-1.5",
              mode === "group"
                ? "bg-white text-[#0052FF] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Grupp
          </button>
        </div>

        {/* Group name (group mode only) */}
        {mode === "group" && (
          <Input
            label="Gruppnamn"
            placeholder="t.ex. Q4-projektet"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={80}
            disabled={submitting}
            required
            autoFocus
          />
        )}

        {/* Friend picker */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            {mode === "private" ? "Välj en vän" : `Välj deltagare (${selected.size} valda)`}
          </label>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök bland vänner..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
            />
          </div>

          <div className="rounded-xl border border-slate-200 max-h-64 overflow-y-auto">
            {friendsLoading ? (
              <FriendsSkeleton />
            ) : filteredFriends.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-slate-500 font-mono">
                  {friendUids.length === 0
                    ? "Inga vänner än. Lägg till en kollega först."
                    : `Inga träffar för "${search.trim()}".`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredFriends.map((p) => {
                  const isSelected = selected.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleSelect(p.id)}
                      disabled={submitting}
                      className={cn(
                        "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors",
                        isSelected
                          ? "bg-blue-50 hover:bg-blue-50/80"
                          : "hover:bg-slate-50"
                      )}
                    >
                      <Avatar name={p.displayName} src={p.photoURL} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-body font-semibold text-slate-900 truncate">
                          {p.displayName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono truncate">
                          {p.email}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all",
                          isSelected
                            ? "bg-[#0052FF] border-[#0052FF]"
                            : "bg-white border-slate-300"
                        )}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          >
            {mode === "private" ? "Starta chatt" : "Skapa grupp"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FriendsSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-3 py-2.5 flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/2 rounded bg-slate-200" />
            <div className="h-2 w-1/3 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
