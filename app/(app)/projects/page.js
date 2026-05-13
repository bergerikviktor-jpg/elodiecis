"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderKanban,
  Users,
  Clock,
  ArrowUpRight,
  ChevronDown,
  UsersRound,
  Loader2,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import NewProjectModal from "@/components/modals/NewProjectModal";

import { useAuth } from "@/contexts/AuthContext";
import { useTeams } from "@/lib/useTeamsData";
import { useProjects } from "@/lib/useProjectsData";
import { useUserProfiles } from "@/lib/useChatData";
import { PROJECT_ACCENTS } from "@/lib/projects";
import { PROJECT_PHASES } from "@/lib/schema";
import { formatRelativeTime, cn } from "@/lib/utils";
import { formatSEK } from "@/lib/profitShares";

const LAST_TEAM_KEY = "elodie:projects:lastTeamId:";

export default function ProjectsPage() {
  const { user } = useAuth();
  const { teams, loading: teamsLoading } = useTeams(user?.uid);

  // Persisted team selection (per-user)
  const storageKey = user ? `${LAST_TEAM_KEY}${user.uid}` : null;
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) setSelectedTeamId(cached);
    } catch {
      /* noop */
    }
  }, [storageKey]);

  useEffect(() => {
    if (teamsLoading) return;
    if (teams.length === 0) {
      if (selectedTeamId !== null) setSelectedTeamId(null);
      return;
    }
    const stillMember = selectedTeamId
      ? teams.some((t) => t.id === selectedTeamId)
      : false;
    if (!stillMember) setSelectedTeamId(teams[0].id);
  }, [teamsLoading, teams, selectedTeamId]);

  useEffect(() => {
    if (!storageKey || !selectedTeamId) return;
    try {
      localStorage.setItem(storageKey, selectedTeamId);
    } catch {
      /* noop */
    }
  }, [storageKey, selectedTeamId]);

  const { projects, loading: projectsLoading } = useProjects(selectedTeamId);

  const [createOpen, setCreateOpen] = useState(false);

  /* ── Render guards ──────────────────────────────────────────── */

  if (teamsLoading) {
    return (
      <>
        <Header title="Projekt" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  if (teams.length === 0) {
    return (
      <>
        <Header title="Projekt" subtitle="// inga team än" />
        <div className="p-8 max-w-2xl mx-auto">
          <Card padding="none">
            <EmptyState
              icon={UsersRound}
              title="Du måste tillhöra ett team"
              description="Projekt är teambaserade. Skapa eller acceptera en inbjudan till ett team först."
              action={
                <Button onClick={() => (window.location.href = "/team")}>
                  Gå till team
                </Button>
              }
            />
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Projekt"
        subtitle={
          projectsLoading
            ? "// laddar..."
            : `// ${projects.length} aktiva projekt`
        }
        actions={
          <Button
            icon={Plus}
            onClick={() => setCreateOpen(true)}
            disabled={!selectedTeamId}
          >
            Nytt projekt
          </Button>
        }
      />

      <div className="px-8 pt-4">
        <TeamPicker
          teams={teams}
          value={selectedTeamId}
          onChange={setSelectedTeamId}
        />
      </div>

      <div className="p-8 animate-fade-in">
        {projectsLoading ? (
          <ProjectsSkeleton />
        ) : projects.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={FolderKanban}
              title="Inga projekt än"
              description="Skapa ditt första filmprojekt — moodboards, ekonomi, vinstfördelning, allt på ett ställe."
              action={
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  Nytt projekt
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger-children">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                teamId={selectedTeamId}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        teamId={selectedTeamId}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   ProjectCard — list-view summary
   ────────────────────────────────────────────────────────────────── */

function ProjectCard({ project, teamId }) {
  const accent =
    PROJECT_ACCENTS.find((a) => a.id === project.coverColor) ||
    PROJECT_ACCENTS[0];
  const phase =
    PROJECT_PHASES.find((p) => p.id === project.phase) || PROJECT_PHASES[0];

  const netResult = (project.totalBudget || 0) - (project.totalExpenses || 0);
  const marginPct =
    project.totalBudget > 0
      ? Math.round((netResult / project.totalBudget) * 100)
      : 0;

  const { profiles } = useUserProfiles(project.members || []);
  const memberPreview = (project.members || [])
    .map((u) => profiles.get(u))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Link href={`/projects/${project.id}?team=${teamId}`}>
      <Card hover padding="none" className="group overflow-hidden">
        {/* Banner */}
        <div className="h-20 relative" style={{ background: accent.value }}>
          <div className="absolute inset-0 bg-black/10" />
          <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
            <h3 className="text-base font-body font-bold text-white tracking-tight truncate drop-shadow">
              {project.title}
            </h3>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-mono truncate">
                {project.customerName || "Ingen kund angiven"}
              </p>
            </div>
            <Badge color={phase.color} size="xs">
              {phase.label}
            </Badge>
          </div>

          {/* Money row */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Budget" value={formatSEK(project.totalBudget || 0)} />
            <Stat
              label="Utgifter"
              value={formatSEK(project.totalExpenses || 0)}
              tone="muted"
            />
            <Stat
              label="Netto"
              value={formatSEK(netResult)}
              tone={netResult < 0 ? "negative" : "positive"}
              accessory={
                project.totalBudget > 0 ? `${marginPct}%` : null
              }
            />
          </div>

          {/* Footer: members + updated */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center -space-x-1.5">
              {memberPreview.map((p) => (
                <Avatar
                  key={p.id}
                  name={p.displayName}
                  src={p.photoURL}
                  size="xs"
                  className="ring-2 ring-white"
                />
              ))}
              {(project.members?.length || 0) > memberPreview.length && (
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-mono font-semibold flex items-center justify-center ring-2 ring-white">
                  +{project.members.length - memberPreview.length}
                </div>
              )}
              {memberPreview.length === 0 && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Inga medlemmar
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono">
                {formatRelativeTime(project.updatedAt || project.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value, tone = "default", accessory }) {
  const toneClass = {
    default: "text-slate-900",
    muted: "text-slate-600",
    positive: "text-emerald-600",
    negative: "text-red-600",
  }[tone];
  return (
    <div>
      <p className="text-[9px] font-mono font-medium text-slate-400 uppercase tracking-widest">
        {label}
      </p>
      <p className={cn("text-sm font-mono font-semibold mt-0.5 truncate", toneClass)}>
        {value}
      </p>
      {accessory && (
        <p className="text-[9px] font-mono text-slate-400 mt-0.5">
          {accessory}
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   TeamPicker (same UX as /pipeline)
   ────────────────────────────────────────────────────────────────── */

function TeamPicker({ teams, value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = teams.find((t) => t.id === value);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-card hover:border-[#0052FF]/30 transition-all duration-200"
      >
        <UsersRound className="w-4 h-4 text-slate-500" />
        <div className="text-left">
          <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest leading-none">
            Team
          </p>
          <p className="text-sm font-body font-semibold text-slate-900 leading-tight mt-0.5">
            {current?.name || "Välj team"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-20 w-72 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
            <div className="max-h-72 overflow-y-auto">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors",
                    t.id === value
                      ? "bg-blue-50 text-[#0052FF]"
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-body font-semibold truncate">
                      {t.name}
                    </p>
                  </div>
                  {t.id === value && (
                    <span className="w-2 h-2 rounded-full bg-[#0052FF] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} padding="none">
          <div className="h-20 bg-slate-200 animate-pulse" />
          <div className="p-5 space-y-4 animate-pulse">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-8 rounded bg-slate-100" />
              <div className="h-8 rounded bg-slate-100" />
              <div className="h-8 rounded bg-slate-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
