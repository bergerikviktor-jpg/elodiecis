"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  Search,
  UserPlus,
  UsersRound,
  UserCheck,
  Clock,
  Check,
  X,
  Trash2,
  Loader2,
  Inbox,
  Send,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import RemoveFriendModal from "@/components/modals/RemoveFriendModal";
import TeamsSection from "@/components/team/TeamsSection";

import { cn } from "@/lib/utils";

import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useChat } from "@/contexts/ChatContext";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchUserProfiles,
  searchUsers,
  sendFriendRequest,
} from "@/lib/friends";

/* ──────────────────────────────────────────────────────────────────
   useFriendsData — single hook bundling the three realtime listeners
   plus a profile-fetcher cache for the "other" user in each row.
   ────────────────────────────────────────────────────────────────── */

function useFriendsData() {
  const { user } = useAuth();
  const [friendships, setFriendships] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [profiles, setProfiles] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // Realtime listeners — friendships, incoming, outgoing.
  useEffect(() => {
    if (!user) {
      setFriendships([]);
      setIncoming([]);
      setOutgoing([]);
      setLoading(false);
      return;
    }

    let pendingSnapshots = 3;
    const markReady = () => {
      pendingSnapshots -= 1;
      if (pendingSnapshots <= 0) setLoading(false);
    };

    const unsubFriendships = onSnapshot(
      query(
        collection(db, "friendships"),
        where("users", "array-contains", user.uid)
      ),
      (snap) => {
        setFriendships(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        markReady();
      },
      (err) => {
        console.error("friendships listener error:", err);
        markReady();
      }
    );

    const unsubIncoming = onSnapshot(
      query(
        collection(db, "friendRequests"),
        where("toUid", "==", user.uid),
        where("status", "==", "pending")
      ),
      (snap) => {
        setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        markReady();
      },
      (err) => {
        console.error("incoming listener error:", err);
        markReady();
      }
    );

    const unsubOutgoing = onSnapshot(
      query(
        collection(db, "friendRequests"),
        where("fromUid", "==", user.uid),
        where("status", "==", "pending")
      ),
      (snap) => {
        setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        markReady();
      },
      (err) => {
        console.error("outgoing listener error:", err);
        markReady();
      }
    );

    return () => {
      unsubFriendships();
      unsubIncoming();
      unsubOutgoing();
    };
  }, [user]);

  // Resolve "other party" profile for every friendship/request row.
  const otherUids = useMemo(() => {
    if (!user) return [];
    const set = new Set();
    friendships.forEach((f) => {
      f.users?.forEach((u) => u !== user.uid && set.add(u));
    });
    incoming.forEach((r) => set.add(r.fromUid));
    outgoing.forEach((r) => set.add(r.toUid));
    return Array.from(set);
  }, [user, friendships, incoming, outgoing]);

  useEffect(() => {
    if (otherUids.length === 0) return;
    // Fetch only uids we haven't cached.
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

  // Quick lookups used by the search section.
  const friendUids = useMemo(() => {
    if (!user) return new Set();
    const s = new Set();
    friendships.forEach((f) =>
      f.users?.forEach((u) => u !== user.uid && s.add(u))
    );
    return s;
  }, [user, friendships]);

  const incomingByUid = useMemo(() => {
    const m = new Map();
    incoming.forEach((r) => m.set(r.fromUid, r));
    return m;
  }, [incoming]);

  const outgoingByUid = useMemo(() => {
    const m = new Map();
    outgoing.forEach((r) => m.set(r.toUid, r));
    return m;
  }, [outgoing]);

  return {
    user,
    loading,
    friendships,
    incoming,
    outgoing,
    profiles,
    friendUids,
    incomingByUid,
    outgoingByUid,
  };
}

/* ──────────────────────────────────────────────────────────────────
   useUserSearch — debounced live search against the users collection.
   ────────────────────────────────────────────────────────────────── */

function useUserSearch(currentUid) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length < 2 || !currentUid) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const myReq = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const r = await searchUsers(trimmed, currentUid);
        // Discard stale results from prior keystrokes.
        if (myReq === reqId.current) {
          setResults(r);
          setSearching(false);
        }
      } catch (err) {
        console.error("search error:", err);
        if (myReq === reqId.current) {
          setResults([]);
          setSearching(false);
        }
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [input, currentUid]);

  return { input, setInput, results, searching };
}

/* ──────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────── */

export default function TeamPage() {
  const toast = useToast();
  const chat = useChat();
  const data = useFriendsData();
  const search = useUserSearch(data.user?.uid);

  // Tab bar: teams (primary) vs kollegor (friends, existing flow).
  const [tab, setTab] = useState("teams");

  // Per-row pending action state — shows a spinner on the specific button.
  const [pending, setPending] = useState(new Set());
  const setRowPending = (key, on) =>
    setPending((prev) => {
      const next = new Set(prev);
      on ? next.add(key) : next.delete(key);
      return next;
    });

  // Remove-friend modal state
  const [removeTarget, setRemoveTarget] = useState(null);

  /* ── Action handlers ─────────────────────────────────────────── */

  const onSendRequest = async (otherUser) => {
    const key = `send:${otherUser.id}`;
    setRowPending(key, true);
    try {
      await sendFriendRequest(data.user.uid, otherUser.id);
      toast.success(`Förfrågan skickad till ${otherUser.displayName || otherUser.email}.`);
    } catch (err) {
      console.error("sendFriendRequest failed", { code: err?.code, message: err?.message, err });
      toast.error(err.message || "Kunde inte skicka förfrågan.");
    } finally {
      setRowPending(key, false);
    }
  };

  const onAccept = async (request) => {
    const key = `accept:${request.id}`;
    setRowPending(key, true);
    try {
      await acceptFriendRequest(request.id, data.user.uid);
      toast.success("Vänförfrågan accepterad.");
    } catch (err) {
      toast.error(err.message || "Kunde inte acceptera förfrågan.");
    } finally {
      setRowPending(key, false);
    }
  };

  const onDecline = async (request) => {
    const key = `decline:${request.id}`;
    setRowPending(key, true);
    try {
      await declineFriendRequest(request.id, data.user.uid);
      toast.info("Förfrågan nekad.");
    } catch (err) {
      toast.error(err.message || "Kunde inte neka förfrågan.");
    } finally {
      setRowPending(key, false);
    }
  };

  const onCancel = async (request) => {
    const key = `cancel:${request.id}`;
    setRowPending(key, true);
    try {
      await cancelFriendRequest(request.id, data.user.uid);
      toast.info("Förfrågan avbruten.");
    } catch (err) {
      toast.error(err.message || "Kunde inte avbryta förfrågan.");
    } finally {
      setRowPending(key, false);
    }
  };

  /* ── Derive "friends" list with full profiles ────────────────── */

  const friendsList = useMemo(() => {
    if (!data.user) return [];
    return data.friendships
      .map((f) => {
        const otherUid = f.users.find((u) => u !== data.user.uid);
        const profile = data.profiles.get(otherUid);
        return profile ? { ...profile, friendshipId: f.id } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || "", "sv"));
  }, [data.user, data.friendships, data.profiles]);

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <>
      <Header
        title="Team"
        subtitle={
          tab === "teams"
            ? "// teams.list()"
            : data.loading
            ? "// laddar..."
            : `// ${friendsList.length} ${friendsList.length === 1 ? "vän" : "vänner"} · ${data.incoming.length} inkommande · ${data.outgoing.length} skickade`
        }
      />

      {/* Tab bar — Team (primär) + Kollegor (friend-system) */}
      <div className="px-8 pt-6">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          {[
            { id: "teams", label: "Team" },
            { id: "friends", label: "Kollegor" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200",
                tab === t.id
                  ? "bg-white text-[#0052FF] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "teams" && (
        <div className="p-8 animate-fade-in">
          <TeamsSection />
        </div>
      )}

      {tab === "friends" && (
      <div className="p-8 space-y-8 animate-fade-in">
        {/* ── SEARCH SECTION ──────────────────────────────────── */}
        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-sm font-heading text-slate-900">Hitta kollegor</h2>
            <p className="text-xs text-slate-500 font-mono">// users.search()</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search.input}
              onChange={(e) => search.setInput(e.target.value)}
              placeholder="Sök på namn eller e-postadress..."
              className="w-full pl-11 pr-11 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 shadow-card focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
            />
            {search.searching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0052FF] animate-spin" />
            )}
          </div>

          {search.input.trim().length > 0 && search.input.trim().length < 2 && (
            <p className="text-xs text-slate-400 font-mono mt-3">
              Ange minst 2 tecken för att söka.
            </p>
          )}

          {search.input.trim().length >= 2 && (
            <div className="mt-4">
              {search.searching ? (
                <SearchSkeleton />
              ) : search.results.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <p className="text-sm text-slate-500 font-mono">
                    Inga användare matchar &quot;{search.input.trim()}&quot;.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 stagger-children">
                  {search.results.map((u) => {
                    const isFriend = data.friendUids.has(u.id);
                    const incomingFromThem = data.incomingByUid.get(u.id);
                    const outgoingToThem = data.outgoingByUid.get(u.id);

                    return (
                      <SearchRow
                        key={u.id}
                        user={u}
                        state={
                          isFriend
                            ? "friends"
                            : outgoingToThem
                            ? "sent"
                            : incomingFromThem
                            ? "incoming"
                            : "none"
                        }
                        incomingRequest={incomingFromThem}
                        sendPending={pending.has(`send:${u.id}`)}
                        acceptPending={
                          incomingFromThem
                            ? pending.has(`accept:${incomingFromThem.id}`)
                            : false
                        }
                        declinePending={
                          incomingFromThem
                            ? pending.has(`decline:${incomingFromThem.id}`)
                            : false
                        }
                        onSend={() => onSendRequest(u)}
                        onAccept={() => incomingFromThem && onAccept(incomingFromThem)}
                        onDecline={() =>
                          incomingFromThem && onDecline(incomingFromThem)
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── INCOMING REQUESTS ───────────────────────────────── */}
        {data.incoming.length > 0 && (
          <section>
            <SectionHeader
              icon={Inbox}
              title="Inkommande förfrågningar"
              subtitle={`// ${data.incoming.length} väntar på svar`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {data.incoming.map((req) => {
                const profile = data.profiles.get(req.fromUid);
                return (
                  <IncomingCard
                    key={req.id}
                    profile={profile}
                    acceptPending={pending.has(`accept:${req.id}`)}
                    declinePending={pending.has(`decline:${req.id}`)}
                    onAccept={() => onAccept(req)}
                    onDecline={() => onDecline(req)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── SENT REQUESTS ───────────────────────────────────── */}
        {data.outgoing.length > 0 && (
          <section>
            <SectionHeader
              icon={Send}
              title="Skickade förfrågningar"
              subtitle={`// ${data.outgoing.length} väntar på svar`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
              {data.outgoing.map((req) => {
                const profile = data.profiles.get(req.toUid);
                return (
                  <SentCard
                    key={req.id}
                    profile={profile}
                    cancelPending={pending.has(`cancel:${req.id}`)}
                    onCancel={() => onCancel(req)}
                  />
                );
              })}
            </div>
          </section>
        )}

        {/* ── FRIENDS LIST ────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={UsersRound}
            title="Mina vänner"
            subtitle={`// ${friendsList.length} ${friendsList.length === 1 ? "vän" : "vänner"}`}
          />
          {data.loading ? (
            <FriendsSkeleton />
          ) : friendsList.length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon={UsersRound}
                title="Inga vänner än"
                description="Sök efter kollegor i fältet ovan och skicka en vänförfrågan."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
              {friendsList.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  onChat={() => chat.openChat(friend.id)}
                  onRemove={() => setRemoveTarget(friend)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      )}

      <RemoveFriendModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        friend={removeTarget}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-[#0052FF]" />
        </div>
      )}
      <div>
        <h2 className="text-sm font-heading text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500 font-mono">{subtitle}</p>
      </div>
    </div>
  );
}

function SearchRow({
  user,
  state,
  incomingRequest,
  sendPending,
  acceptPending,
  declinePending,
  onSend,
  onAccept,
  onDecline,
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-[#0052FF]/30 hover:bg-blue-50/30 transition-all duration-200">
      <Avatar name={user.displayName} src={user.photoURL} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-body font-semibold text-slate-900 truncate">
          {user.displayName || "—"}
        </p>
        <p className="text-xs text-slate-500 font-mono truncate">{user.email}</p>
      </div>

      {state === "friends" && (
        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-emerald-600 bg-emerald-50 border border-emerald-200">
          <UserCheck className="w-3.5 h-3.5" />
          Vänner
        </span>
      )}

      {state === "sent" && (
        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-500 bg-slate-100 border border-slate-200">
          <Clock className="w-3.5 h-3.5" />
          Skickad
        </span>
      )}

      {state === "incoming" && (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            icon={Check}
            loading={acceptPending}
            disabled={declinePending}
            onClick={onAccept}
          >
            Acceptera
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={X}
            loading={declinePending}
            disabled={acceptPending}
            onClick={onDecline}
          >
            Neka
          </Button>
        </div>
      )}

      {state === "none" && (
        <Button size="sm" icon={UserPlus} loading={sendPending} onClick={onSend}>
          Lägg till
        </Button>
      )}
    </div>
  );
}

function IncomingCard({ profile, acceptPending, declinePending, onAccept, onDecline }) {
  return (
    <Card hover className="group">
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={profile?.displayName} src={profile?.photoURL} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-body font-semibold text-slate-900 truncate group-hover:text-[#0052FF] transition-colors">
            {profile?.displayName || "Laddar..."}
          </p>
          <p className="text-xs text-slate-500 font-mono truncate">
            {profile?.email || "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <Button
          size="sm"
          icon={Check}
          loading={acceptPending}
          disabled={declinePending}
          onClick={onAccept}
          className="flex-1"
        >
          Acceptera
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={X}
          loading={declinePending}
          disabled={acceptPending}
          onClick={onDecline}
          className="flex-1"
        >
          Neka
        </Button>
      </div>
    </Card>
  );
}

function SentCard({ profile, cancelPending, onCancel }) {
  return (
    <Card hover className="group">
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={profile?.displayName} src={profile?.photoURL} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-body font-semibold text-slate-900 truncate group-hover:text-[#0052FF] transition-colors">
            {profile?.displayName || "Laddar..."}
          </p>
          <p className="text-xs text-slate-500 font-mono truncate">
            {profile?.email || "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
          <Clock className="w-3 h-3" />
          Väntar
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={X}
          loading={cancelPending}
          onClick={onCancel}
        >
          Avbryt
        </Button>
      </div>
    </Card>
  );
}

function FriendCard({ friend, onChat, onRemove }) {
  return (
    <Card hover className="group">
      <div className="flex items-center gap-4 mb-4">
        <Avatar name={friend.displayName} src={friend.photoURL} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-body font-semibold text-slate-900 group-hover:text-[#0052FF] transition-colors tracking-tight truncate">
            {friend.displayName}
          </h3>
          <p className="text-xs text-slate-500 font-mono truncate">
            {friend.email}
          </p>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
        <Button
          size="sm"
          icon={MessageSquare}
          onClick={onChat}
          className="flex-1"
        >
          Chatta
        </Button>
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
          title="Ta bort vän"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </Card>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white"
        >
          <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-200 animate-pulse" />
            <div className="h-2 w-1/3 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="w-24 h-8 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function FriendsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
