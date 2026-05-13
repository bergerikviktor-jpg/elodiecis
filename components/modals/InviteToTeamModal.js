"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Check, UserPlus, Shield } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { sendInvitation } from "@/lib/teams";
import { cn } from "@/lib/utils";

/**
 * Invite users to an existing team. The caller is owner OR admin
 * (parent UI hides the button otherwise). Only the owner may toggle
 * "Som admin" for invitees — admins can only invite regular members.
 */
export default function InviteToTeamModal({
  isOpen,
  onClose,
  team,
  pendingInviteUids = new Set(),
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [asAdmin, setAsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
          (d.data().users || []).forEach((u) => u !== user.uid && uids.add(u));
        });
        setFriendUids(Array.from(uids));
        setFriendsLoading(false);
      },
      () => setFriendsLoading(false)
    );
    return () => unsub();
  }, [user, isOpen]);

  const { profiles } = useUserProfiles(friendUids);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setSelected(new Set());
      setAsAdmin(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const isOwner = user && team && team.ownerUid === user.uid;

  // Filter out already-member candidates + people with pending invites.
  const exclusionSet = useMemo(() => {
    const s = new Set(team?.members || []);
    pendingInviteUids.forEach((u) => s.add(u));
    return s;
  }, [team, pendingInviteUids]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = friendUids
      .map((uid) => profiles.get(uid))
      .filter(Boolean)
      .filter((p) => !exclusionSet.has(p.id))
      .sort((a, b) =>
        (a.displayName || "").localeCompare(b.displayName || "", "sv")
      );
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.displayName || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [friendUids, profiles, search, exclusionSet]);

  const toggle = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleSend = async () => {
    if (!team || !user || selected.size === 0) return;
    setSubmitting(true);
    const role = asAdmin && isOwner ? "admin" : "member";
    const failures = [];
    for (const uid of selected) {
      try {
        await sendInvitation(team.id, uid, role, user.uid);
      } catch (err) {
        console.error("sendInvitation failed", err?.code, err?.message);
        failures.push(uid);
      }
    }
    setSubmitting(false);
    if (failures.length === 0) {
      toast.success(
        `${selected.size} ${selected.size === 1 ? "inbjudan" : "inbjudningar"} skickad${selected.size === 1 ? "" : "e"}.`
      );
      onClose?.();
    } else if (failures.length < selected.size) {
      toast.info(
        `${selected.size - failures.length} skickade, ${failures.length} misslyckades.`
      );
    } else {
      toast.error("Inga inbjudningar gick igenom.");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose?.()}
      title="Bjud in till teamet"
      subtitle="// team.invite()"
    >
      <div className="space-y-4">
        {isOwner && (
          <button
            type="button"
            onClick={() => setAsAdmin((v) => !v)}
            disabled={submitting}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
              asAdmin
                ? "border-[#0052FF]/40 bg-blue-50"
                : "border-slate-200 bg-white hover:bg-slate-50"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                asAdmin ? "bg-[#0052FF] text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-body font-semibold text-slate-900">
                Bjud in som admin
              </p>
              <p className="text-xs text-slate-500 font-mono mt-0.5 leading-relaxed">
                Admins kan bjuda in fler medlemmar och ändra teamets inställningar.
              </p>
            </div>
            <div
              className={cn(
                "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-1 transition-all",
                asAdmin
                  ? "bg-[#0052FF] border-[#0052FF]"
                  : "bg-white border-slate-300"
              )}
            >
              {asAdmin && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
          </button>
        )}

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

        <div className="rounded-xl border border-slate-200 max-h-64 overflow-y-auto">
          {friendsLoading ? (
            <Skeleton />
          ) : candidates.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-500 font-mono">
                {friendUids.length === 0
                  ? "Inga vänner att bjuda in."
                  : exclusionSet.size > 0 && search.length === 0
                  ? "Alla dina vänner är redan medlemmar eller väntar på svar."
                  : `Inga träffar för "${search.trim()}".`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {candidates.map((p) => {
                const picked = selected.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    disabled={submitting}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors",
                      picked
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
                        picked
                          ? "bg-[#0052FF] border-[#0052FF]"
                          : "bg-white border-slate-300"
                      )}
                    >
                      {picked && <Check className="w-3.5 h-3.5 text-white" />}
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
            onClick={handleSend}
            loading={submitting}
            disabled={selected.size === 0}
          >
            Skicka inbjudan ({selected.size})
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
