"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Check, UsersRound } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { createTeam, TEAM_ACCENTS } from "@/lib/teams";
import { cn } from "@/lib/utils";

/**
 * Two-step team creation:
 *   1. Identity — namn, beskrivning, accent-färg
 *   2. Initial-invites — välj från vänlistan (valfritt)
 *
 * Skapad team får dig som ägare + enda medlem. Invitees får invitations
 * som de kan acceptera/neka från /team.
 */
export default function NewTeamModal({ isOpen, onClose }) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accentColor, setAccentColor] = useState(TEAM_ACCENTS[0].id);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Friend list for invitee picker
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

  // Reset on close.
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setName("");
      setDescription("");
      setAccentColor(TEAM_ACCENTS[0].id);
      setSelected(new Set());
      setSearch("");
      setError("");
      setSubmitting(false);
    }
  }, [isOpen]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const trimmedName = name.trim();
  const nameValid = trimmedName.length > 0 && trimmedName.length <= 80;

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

  const toggle = (uid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user || !nameValid) return;
    setError("");
    setSubmitting(true);
    try {
      const teamId = await createTeam(user.uid, {
        name: trimmedName,
        description,
        accentColor,
        initialMemberUids: Array.from(selected),
      });
      toast.success(`Teamet "${trimmedName}" har skapats.`);
      onClose?.();
      router.push(`/team/${teamId}`);
    } catch (err) {
      console.error("createTeam failed", err?.code, err?.message);
      setError(err.message || "Kunde inte skapa teamet.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={step === 1 ? "Nytt team" : "Bjud in medlemmar"}
      subtitle={step === 1 ? "// team.create()" : "// team.invite()"}
    >
      {step === 1 ? (
        <div className="space-y-4">
          <Input
            label="Teamnamn"
            autoFocus
            placeholder="t.ex. Videoteamet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            disabled={submitting}
            required
          />
          <Textarea
            label="Beskrivning (valfri)"
            placeholder="Vad är teamets uppdrag?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={submitting}
          />

          <div>
            <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
              Accent-färg
            </label>
            <div className="grid grid-cols-5 gap-2">
              {TEAM_ACCENTS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setAccentColor(bg.id)}
                  disabled={submitting}
                  className={cn(
                    "aspect-square rounded-xl border-2 transition-all duration-200",
                    accentColor === bg.id
                      ? "border-[#0052FF] scale-105 shadow-glow"
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ background: bg.value }}
                  aria-label={`Färg ${bg.id}`}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={close}>
              Avbryt
            </Button>
            <Button onClick={() => setStep(2)} disabled={!nameValid}>
              Nästa
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-500 leading-relaxed">
            Bjud in kollegor som medlemmar. De får en inbjudan att acceptera
            från sin egen <span className="text-slate-700 font-semibold">/team</span>-sida.
            Du kan alltid bjuda in fler senare.
          </div>

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
            ) : filteredFriends.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <UsersRound className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-mono">
                  {friendUids.length === 0
                    ? "Inga vänner än. Du kan bjuda in folk senare."
                    : `Inga träffar för "${search.trim()}".`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredFriends.map((p) => {
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

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs text-red-600 font-mono">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              disabled={submitting}
            >
              ← Tillbaka
            </Button>
            <Button onClick={handleCreate} loading={submitting}>
              {selected.size > 0
                ? `Skapa team & bjud in (${selected.size})`
                : "Skapa team"}
            </Button>
          </div>
        </div>
      )}
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
