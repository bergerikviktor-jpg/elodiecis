"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  UserPlus,
  Crown,
  Shield,
  MoreVertical,
  Trash2,
  LogOut,
  Pencil,
  Loader2,
  Check,
  X,
  ArrowRightLeft,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/FormFields";
import InviteToTeamModal from "@/components/modals/InviteToTeamModal";
import Modal from "@/components/ui/Modal";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTeam, useTeamInvitations } from "@/lib/useTeamsData";
import { useUserProfiles } from "@/lib/useChatData";
import {
  TEAM_ACCENTS,
  deleteTeam,
  demoteFromAdmin,
  leaveTeam,
  promoteToAdmin,
  removeMember,
  revokeInvitation,
  transferOwnership,
  updateTeamMeta,
} from "@/lib/teams";
import { formatRelativeTime, cn } from "@/lib/utils";

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const teamId = params?.teamId;
  const { user } = useAuth();
  const toast = useToast();

  const { team, loading } = useTeam(teamId);
  const { invitations, loading: invitesLoading } = useTeamInvitations(teamId);

  // Resolve member profiles (and invitation profiles).
  const memberAndInviteeUids = useMemo(() => {
    if (!team) return [];
    const s = new Set(team.members || []);
    invitations.forEach((i) => s.add(i.invitedUid));
    return Array.from(s);
  }, [team, invitations]);
  const { profiles } = useUserProfiles(memberAndInviteeUids);

  /* ── Action modals ────────────────────────────────────────── */
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [transferTargetUid, setTransferTargetUid] = useState(null);

  if (loading || !team) {
    return (
      <>
        <Header title="Team" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  if (!user || !(team.members || []).includes(user.uid)) {
    // Either auth not loaded, or user isn't a member. Bounce back.
    return (
      <>
        <Header title="Team" subtitle="// access denied" />
        <div className="p-8">
          <Card>
            <p className="text-sm font-body text-slate-700">
              Du har inte tillgång till det här teamet längre.
            </p>
            <Button
              variant="ghost"
              onClick={() => router.replace("/team")}
              className="mt-4"
            >
              Tillbaka till team
            </Button>
          </Card>
        </div>
      </>
    );
  }

  const accent =
    TEAM_ACCENTS.find((a) => a.id === team.accentColor) || TEAM_ACCENTS[0];

  const isOwner = team.ownerUid === user.uid;
  const isAdmin = (team.adminUids || []).includes(user.uid);
  const canManage = isOwner || isAdmin;

  // Sort members into role buckets.
  const adminSet = new Set(team.adminUids || []);
  const ownerMember = team.members.find((u) => u === team.ownerUid);
  const adminMembers = team.members.filter(
    (u) => u !== team.ownerUid && adminSet.has(u)
  );
  const regularMembers = team.members.filter(
    (u) => u !== team.ownerUid && !adminSet.has(u)
  );

  const pendingInviteUids = new Set(invitations.map((i) => i.invitedUid));

  return (
    <>
      {/* Banner */}
      <div className="px-8 pt-6 pb-6 relative" style={{ background: accent.value }}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/team"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors"
              aria-label="Tillbaka till team"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-heading text-white tracking-tight truncate">
                  {team.name}
                </h1>
                {isOwner && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-mono uppercase tracking-wider">
                    <Crown className="w-2.5 h-2.5" /> Ägare
                  </span>
                )}
                {!isOwner && isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-mono uppercase tracking-wider">
                    <Shield className="w-2.5 h-2.5" /> Admin
                  </span>
                )}
              </div>
              {team.description && (
                <p className="text-xs text-white/80 font-mono mt-1 max-w-2xl">
                  {team.description}
                </p>
              )}
              <p className="text-[10px] text-white/60 font-mono mt-1">
                {team.memberCount || team.members.length}{" "}
                {(team.memberCount || team.members.length) === 1
                  ? "medlem"
                  : "medlemmar"}{" "}
                · Skapat {formatRelativeTime(team.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-mono font-medium transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Bjud in
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors"
                aria-label="Redigera team"
                title="Redigera team"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {!isOwner && (
              <button
                type="button"
                onClick={() => setConfirmLeave(true)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-amber-500/30 backdrop-blur-md text-white transition-colors"
                aria-label="Lämna team"
                title="Lämna team"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/30 backdrop-blur-md text-white transition-colors"
                aria-label="Radera team"
                title="Radera team"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* ── Ägare ───────────────────────────────────────────── */}
        {ownerMember && (
          <RoleSection
            icon={Crown}
            label="Ägare"
            count={1}
            badgeColor="text-amber-600 bg-amber-50 border-amber-200"
          >
            <MemberRow
              member={profiles.get(ownerMember)}
              uid={ownerMember}
              role="owner"
              currentUid={user.uid}
              isOwner={isOwner}
              isAdmin={isAdmin}
              team={team}
              onTransfer={() => setTransferTargetUid(ownerMember)}
            />
          </RoleSection>
        )}

        {/* ── Admins ──────────────────────────────────────────── */}
        {adminMembers.length > 0 && (
          <RoleSection
            icon={Shield}
            label="Admins"
            count={adminMembers.length}
            badgeColor="text-blue-600 bg-blue-50 border-blue-200"
          >
            <div className="divide-y divide-slate-100">
              {adminMembers.map((uid) => (
                <MemberRow
                  key={uid}
                  member={profiles.get(uid)}
                  uid={uid}
                  role="admin"
                  currentUid={user.uid}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  team={team}
                  onTransfer={() => setTransferTargetUid(uid)}
                />
              ))}
            </div>
          </RoleSection>
        )}

        {/* ── Medlemmar ───────────────────────────────────────── */}
        {regularMembers.length > 0 && (
          <RoleSection
            icon={null}
            label="Medlemmar"
            count={regularMembers.length}
            badgeColor="text-slate-600 bg-slate-100 border-slate-200"
          >
            <div className="divide-y divide-slate-100">
              {regularMembers.map((uid) => (
                <MemberRow
                  key={uid}
                  member={profiles.get(uid)}
                  uid={uid}
                  role="member"
                  currentUid={user.uid}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  team={team}
                  onTransfer={() => setTransferTargetUid(uid)}
                />
              ))}
            </div>
          </RoleSection>
        )}

        {/* ── Pending invitations ─────────────────────────────── */}
        {invitations.length > 0 && (
          <Card padding="none">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-heading text-slate-900">
                Väntande inbjudningar
              </h3>
              <p className="text-[10px] text-slate-500 font-mono">
                // {invitations.length} {invitations.length === 1 ? "person" : "personer"}
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {invitations.map((inv) => (
                <InvitationRow
                  key={inv.id}
                  invitation={inv}
                  profile={profiles.get(inv.invitedUid)}
                  canManage={canManage}
                  teamId={team.id}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Modals */}
      <InviteToTeamModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        team={team}
        pendingInviteUids={pendingInviteUids}
      />

      <EditTeamModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        team={team}
      />

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Radera team"
        subtitle="// team.delete()"
        message="Är du säker på att du vill radera teamet permanent? Alla inbjudningar tas också bort. Detta kan inte ångras."
        confirmLabel="Radera teamet"
        confirmVariant="danger"
        onConfirm={async () => {
          try {
            await deleteTeam(team.id);
            toast.success(`Teamet "${team.name}" har raderats.`);
            router.replace("/team");
          } catch (err) {
            console.error("deleteTeam failed", err?.code, err?.message);
            toast.error(err.message || "Kunde inte radera teamet.");
          }
        }}
      />

      <ConfirmModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Lämna team"
        subtitle="// team.leave()"
        message={`Är du säker på att du vill lämna "${team.name}"? Du kan be om en ny inbjudan senare.`}
        confirmLabel="Lämna teamet"
        confirmVariant="danger"
        onConfirm={async () => {
          try {
            await leaveTeam(team.id, user.uid);
            toast.success(`Du har lämnat "${team.name}".`);
            router.replace("/team");
          } catch (err) {
            console.error("leaveTeam failed", err?.code, err?.message);
            toast.error(err.message || "Kunde inte lämna teamet.");
          }
        }}
      />

      <TransferOwnershipModal
        isOpen={!!transferTargetUid && transferTargetUid !== team.ownerUid}
        targetUid={transferTargetUid}
        team={team}
        profile={profiles.get(transferTargetUid)}
        onClose={() => setTransferTargetUid(null)}
        onConfirm={async () => {
          try {
            await transferOwnership(team.id, user.uid, transferTargetUid);
            toast.success(`Ägarskapet har överlåtits.`);
            setTransferTargetUid(null);
          } catch (err) {
            console.error("transferOwnership failed", err?.code, err?.message);
            toast.error(err.message || "Kunde inte överlåta ägarskap.");
          }
        }}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function RoleSection({ icon: Icon, label, count, badgeColor, children }) {
  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
        <h3 className="text-sm font-heading text-slate-900">{label}</h3>
        <span
          className={cn(
            "text-[10px] font-mono px-2 py-0.5 rounded-full border",
            badgeColor
          )}
        >
          {count}
        </span>
      </div>
      {children}
    </Card>
  );
}

function MemberRow({
  member,
  uid,
  role, // "owner" | "admin" | "member"
  currentUid,
  isOwner,
  isAdmin,
  team,
  onTransfer,
}) {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const isSelf = uid === currentUid;

  // What actions can the viewer perform on THIS row?
  const canPromote = isOwner && role === "member";
  const canDemote = isOwner && role === "admin";
  const canRemove =
    (isOwner || isAdmin) && role !== "owner" && !isSelf;
  const canTransfer = isOwner && role !== "owner";

  const hasActions = canPromote || canDemote || canRemove || canTransfer;

  const handle = async (label, fn) => {
    setMenuOpen(false);
    try {
      await fn();
      toast.success(label);
    } catch (err) {
      console.error("member action failed", err?.code, err?.message);
      toast.error(err.message || "Åtgärden gick inte att utföra.");
    }
  };

  return (
    <div className="px-5 py-3 flex items-center gap-3">
      <Avatar
        name={member?.displayName}
        src={member?.photoURL}
        size="md"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-body font-semibold text-slate-900 truncate">
            {member?.displayName || "Laddar..."}
          </p>
          {isSelf && (
            <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
              Du
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500 font-mono truncate">
          {member?.email}
        </p>
      </div>
      {hasActions && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
            aria-label="Medlemsmeny"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
                {canPromote && (
                  <MenuItem
                    icon={Shield}
                    label="Befordra till admin"
                    onClick={() =>
                      handle("Befordrad till admin.", () =>
                        promoteToAdmin(team.id, uid)
                      )
                    }
                  />
                )}
                {canDemote && (
                  <MenuItem
                    icon={Shield}
                    label="Degradera till medlem"
                    onClick={() =>
                      handle("Degraderad till medlem.", () =>
                        demoteFromAdmin(team.id, uid)
                      )
                    }
                  />
                )}
                {canTransfer && (
                  <MenuItem
                    icon={ArrowRightLeft}
                    label="Överlåt ägarskap"
                    onClick={() => {
                      setMenuOpen(false);
                      onTransfer?.();
                    }}
                  />
                )}
                {canRemove && (
                  <MenuItem
                    icon={Trash2}
                    label="Ta bort från team"
                    danger
                    onClick={() =>
                      handle("Medlemmen har tagits bort.", () =>
                        removeMember(team.id, uid)
                      )
                    }
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, danger = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 transition-colors",
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-50"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function InvitationRow({ invitation, profile, canManage, teamId }) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleRevoke = async () => {
    setSubmitting(true);
    try {
      await revokeInvitation(teamId, invitation.invitedUid);
      toast.info("Inbjudan återkallad.");
    } catch (err) {
      console.error("revokeInvitation failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte återkalla inbjudan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 py-3 flex items-center gap-3">
      <Avatar
        name={profile?.displayName}
        src={profile?.photoURL}
        size="md"
        className="opacity-60 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-body font-semibold text-slate-900 truncate">
          {profile?.displayName || invitation.invitedUid}
        </p>
        <p className="text-[10px] text-slate-500 font-mono truncate">
          Inbjuden som{" "}
          <span className="text-slate-700 font-semibold">
            {invitation.proposedRole === "admin" ? "admin" : "medlem"}
          </span>
          {" · väntar"}
        </p>
      </div>
      {canManage && (
        <Button
          size="sm"
          variant="ghost"
          icon={X}
          loading={submitting}
          onClick={handleRevoke}
        >
          Återkalla
        </Button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Edit / confirm / transfer modals
   ────────────────────────────────────────────────────────────────── */

function EditTeamModal({ isOpen, onClose, team }) {
  const toast = useToast();
  const [name, setName] = useState(team.name || "");
  const [description, setDescription] = useState(team.description || "");
  const [accentColor, setAccentColor] = useState(team.accentColor || "blue");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(team.name || "");
      setDescription(team.description || "");
      setAccentColor(team.accentColor || "blue");
      setSubmitting(false);
    }
  }, [isOpen, team]);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 80;
  const dirty =
    trimmed !== (team.name || "") ||
    description.trim() !== (team.description || "") ||
    accentColor !== team.accentColor;

  const handleSave = async () => {
    if (!valid || !dirty) return;
    setSubmitting(true);
    try {
      await updateTeamMeta(team.id, {
        name: trimmed,
        description,
        accentColor,
      });
      toast.success("Teamet uppdaterades.");
      onClose?.();
    } catch (err) {
      console.error("updateTeamMeta failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte spara.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose?.()}
      title="Redigera team"
      subtitle="// team.update()"
    >
      <div className="space-y-4">
        <Input
          label="Teamnamn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          disabled={submitting}
          autoFocus
          required
        />
        <Textarea
          label="Beskrivning (valfri)"
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

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            onClick={handleSave}
            loading={submitting}
            disabled={!valid || !dirty}
          >
            Spara ändringar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({
  isOpen,
  onClose,
  title,
  subtitle,
  message,
  confirmLabel,
  confirmVariant = "primary",
  onConfirm,
}) {
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    setSubmitting(true);
    try {
      await onConfirm?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose?.()}
      title={title}
      subtitle={subtitle}
    >
      <div className="space-y-5">
        <p className="text-sm font-body text-slate-700 leading-relaxed">
          {message}
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            variant={confirmVariant}
            loading={submitting}
            onClick={handle}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TransferOwnershipModal({
  isOpen,
  targetUid,
  team,
  profile,
  onClose,
  onConfirm,
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!targetUid || !team) return null;

  const handle = async () => {
    setSubmitting(true);
    try {
      await onConfirm?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose?.()}
      title="Överlåt ägarskap"
      subtitle="// team.transferOwnership()"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-body font-semibold text-slate-900">
              Du förlorar ägarskapet permanent.
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Du blir en vanlig medlem och kan inte längre radera teamet
              eller överlåta ägarskap. Du kan be den nya ägaren att
              befordra dig till admin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <Avatar
            name={profile?.displayName}
            src={profile?.photoURL}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-slate-900 truncate">
              {profile?.displayName || "Laddar..."}
            </p>
            <p className="text-xs text-slate-500 font-mono truncate">
              {profile?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            icon={Check}
            loading={submitting}
            onClick={handle}
          >
            Överlåt ägarskap
          </Button>
        </div>
      </div>
    </Modal>
  );
}
