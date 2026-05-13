"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Check, UserPlus, Users } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { addBoardMembers } from "@/lib/todo";
import { cn } from "@/lib/utils";

/**
 * Invite friends to a board. Lists the signed-in user's friendships
 * (realtime), filters out anyone who is already a member, and lets
 * the user select multiple to invite at once.
 */
export default function InviteToBoardModal({ isOpen, onClose, board }) {
  const { user } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [friendUids, setFriendUids] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);

  // Subscribe to my friendships → derive list of friend uids.
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
        console.error("invite friends listener error:", err?.code, err?.message);
        setFriendsLoading(false);
      }
    );
    return () => unsub();
  }, [user, isOpen]);

  const { profiles } = useUserProfiles(friendUids);

  // Reset state on open/close.
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSelected(new Set());
      setSubmitting(false);
    }
  }, [isOpen]);

  const currentMembers = useMemo(
    () => new Set(board?.members || []),
    [board]
  );

  // Build sortable, filterable list of invite candidates (friends
  // that aren't already members).
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = friendUids
      .map((uid) => profiles.get(uid))
      .filter(Boolean)
      .filter((p) => !currentMembers.has(p.id))
      .sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "", "sv")
      );
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.displayName || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [friendUids, profiles, search, currentMembers]);

  const toggle = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleInvite = async () => {
    if (!board || selected.size === 0) return;
    setSubmitting(true);
    try {
      await addBoardMembers(board.id, Array.from(selected));
      toast.success(
        `${selected.size} ${selected.size === 1 ? "medlem" : "medlemmar"} bjudna in.`
      );
      onClose?.();
    } catch (err) {
      console.error("addBoardMembers failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte bjuda in medlemmar.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose?.()}
      title="Bjud in medlemmar"
      subtitle="// board.invite()"
    >
      <div className="space-y-4">
        {/* Current members preview */}
        {currentMembers.size > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <p className="text-xs text-slate-600 font-mono">
              {currentMembers.size} {currentMembers.size === 1 ? "medlem" : "medlemmar"}{" "}
              i boarden
            </p>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök bland vänner..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
          />
        </div>

        {/* Candidate list */}
        <div className="rounded-xl border border-slate-200 max-h-64 overflow-y-auto">
          {friendsLoading ? (
            <Skeleton />
          ) : candidates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-500 font-mono">
                {friendUids.length === 0
                  ? "Inga vänner att bjuda in."
                  : currentMembers.size > 0 && search.length === 0
                  ? "Alla dina vänner är redan medlemmar."
                  : `Inga träffar för "${search.trim()}".`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {candidates.map((p) => {
                const isSelected = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
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

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onClose?.()} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            icon={UserPlus}
            onClick={handleInvite}
            loading={submitting}
            disabled={selected.size === 0}
          >
            Bjud in ({selected.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Skeleton() {
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
