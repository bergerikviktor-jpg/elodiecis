"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  UsersRound,
  Crown,
  Shield,
  Inbox,
  Check,
  X,
  Loader2,
  ArrowUpRight,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import NewTeamModal from "@/components/modals/NewTeamModal";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useTeams,
  useMyPendingInvitations,
} from "@/lib/useTeamsData";
import { useUserProfiles } from "@/lib/useChatData";
import { TEAM_ACCENTS, acceptInvitation, declineInvitation } from "@/lib/teams";
import { formatRelativeTime, cn } from "@/lib/utils";

/**
 * Primary content for the "Team"-tab on /team. Shows the user's team
 * cards, a "Nytt team"-CTA, and an inbox banner for pending invites.
 */
export default function TeamsSection() {
  const { user } = useAuth();
  const { teams, loading } = useTeams(user?.uid);
  const { invitations, loading: invitesLoading } = useMyPendingInvitations(user?.uid);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      {/* Pending invites banner */}
      {!invitesLoading && invitations.length > 0 && (
        <InvitationsBanner invitations={invitations} myUid={user?.uid} />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-heading text-slate-900">Mina team</h2>
          <p className="text-xs text-slate-500 font-mono">
            // {teams.length} {teams.length === 1 ? "team" : "team"}
          </p>
        </div>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>
          Nytt team
        </Button>
      </div>

      {loading ? (
        <TeamsSkeleton />
      ) : teams.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={UsersRound}
            title="Inga team än"
            description="Skapa ett team för att samla kollegor kring ett gemensamt uppdrag — projekt, avdelning eller produktionsteam."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Nytt team
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} myUid={user?.uid} />
          ))}
        </div>
      )}

      <NewTeamModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Team-kort på listsidan
   ────────────────────────────────────────────────────────────────── */

function TeamCard({ team, myUid }) {
  const accent =
    TEAM_ACCENTS.find((a) => a.id === team.accentColor) || TEAM_ACCENTS[0];
  const isOwner = team.ownerUid === myUid;
  const isAdmin = (team.adminUids || []).includes(myUid);

  const { profiles } = useUserProfiles(team.members || []);
  const memberPreview = (team.members || [])
    .map((u) => profiles.get(u))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Link href={`/team/${team.id}`}>
      <Card hover padding="none" className="group overflow-hidden">
        <div className="h-20 relative" style={{ background: accent.value }}>
          <div className="absolute inset-0 bg-black/10" />
          <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
          {(isOwner || isAdmin) && (
            <span className="absolute bottom-2 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[9px] font-mono uppercase tracking-wider">
              {isOwner ? (
                <>
                  <Crown className="w-2.5 h-2.5" />
                  Ägare
                </>
              ) : (
                <>
                  <Shield className="w-2.5 h-2.5" />
                  Admin
                </>
              )}
            </span>
          )}
        </div>
        <div className="p-5">
          <h3 className="text-base font-body font-bold text-slate-900 group-hover:text-[#0052FF] transition-colors tracking-tight truncate">
            {team.name}
          </h3>
          {team.description && (
            <p className="text-xs text-slate-500 font-mono mt-1 line-clamp-2 leading-relaxed">
              {team.description}
            </p>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-500">
              <UsersRound className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">
                {team.memberCount ?? team.members?.length ?? 0}{" "}
                {(team.memberCount ?? team.members?.length ?? 0) === 1
                  ? "medlem"
                  : "medlemmar"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {formatRelativeTime(team.updatedAt || team.createdAt)}
            </span>
          </div>

          {memberPreview.length > 0 && (
            <div className="flex items-center -space-x-1.5 mt-3">
              {memberPreview.map((p) => (
                <Avatar
                  key={p.id}
                  name={p.displayName}
                  src={p.photoURL}
                  size="xs"
                  className="ring-2 ring-white"
                />
              ))}
              {(team.members?.length || 0) > memberPreview.length && (
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-mono font-semibold flex items-center justify-center ring-2 ring-white">
                  +{team.members.length - memberPreview.length}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Banner: pending invitations till mig
   ────────────────────────────────────────────────────────────────── */

function InvitationsBanner({ invitations, myUid }) {
  return (
    <Card padding="none" className="mb-6">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Inbox className="w-4 h-4 text-amber-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-heading text-slate-900">
            Du är inbjuden till {invitations.length}{" "}
            {invitations.length === 1 ? "team" : "team"}
          </h3>
          <p className="text-[10px] text-slate-500 font-mono">
            // team.invitations()
          </p>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {invitations.map((inv) => (
          <InvitationRow key={`${inv.teamId}-${inv.id}`} invitation={inv} myUid={myUid} />
        ))}
      </div>
    </Card>
  );
}

function InvitationRow({ invitation, myUid }) {
  const toast = useToast();
  const [pending, setPending] = useState(null); // "accept" | "decline" | null

  const handleAccept = async () => {
    setPending("accept");
    try {
      await acceptInvitation(invitation.teamId, myUid);
      toast.success("Inbjudan accepterad.");
    } catch (err) {
      console.error("acceptInvitation failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte acceptera inbjudan.");
      setPending(null);
    }
  };

  const handleDecline = async () => {
    setPending("decline");
    try {
      await declineInvitation(invitation.teamId, myUid);
      toast.info("Inbjudan nekad.");
    } catch (err) {
      console.error("declineInvitation failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte neka inbjudan.");
      setPending(null);
    }
  };

  return (
    <InvitationRowInner
      invitation={invitation}
      pending={pending}
      onAccept={handleAccept}
      onDecline={handleDecline}
    />
  );
}

function InvitationRowInner({ invitation, pending, onAccept, onDecline }) {
  // Lazy-fetch team name (just one doc) — most invites are few, this is fine.
  const [teamMeta, setTeamMeta] = useState(null);
  useMemo(() => {
    // We just want to display name + accentColor; load on mount.
    // We could expose a useTeam(invitation.teamId) but adding listeners
    // per invitation is wasteful — single fetch is enough.
    import("firebase/firestore").then(({ doc, getDoc }) =>
      import("@/lib/firebase").then(({ db }) =>
        getDoc(doc(db, "teams", invitation.teamId)).then((s) => {
          if (s.exists()) setTeamMeta({ id: s.id, ...s.data() });
        })
      )
    );
  }, [invitation.teamId]);

  const accent =
    TEAM_ACCENTS.find((a) => a.id === teamMeta?.accentColor) || TEAM_ACCENTS[0];

  return (
    <div className="px-5 py-3 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl shrink-0"
        style={{ background: accent.value }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-body font-semibold text-slate-900 truncate">
          {teamMeta?.name || "Team"}
        </p>
        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
          Inbjuden som{" "}
          <span className="text-slate-700 font-semibold">
            {invitation.proposedRole === "admin" ? "admin" : "medlem"}
          </span>
          {teamMeta?.memberCount
            ? ` · ${teamMeta.memberCount} ${teamMeta.memberCount === 1 ? "medlem" : "medlemmar"}`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          icon={Check}
          loading={pending === "accept"}
          disabled={pending === "decline"}
          onClick={onAccept}
        >
          Acceptera
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={X}
          loading={pending === "decline"}
          disabled={pending === "accept"}
          onClick={onDecline}
        >
          Neka
        </Button>
      </div>
    </div>
  );
}

function TeamsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} padding="none">
          <div className="h-20 bg-slate-200 animate-pulse" />
          <div className="p-5 space-y-3 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
          </div>
        </Card>
      ))}
    </div>
  );
}
