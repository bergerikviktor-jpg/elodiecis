"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Loader2,
  Wallet,
  LayoutDashboard,
  MessageSquare,
  Archive,
  Layers,
  Brush,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTeam } from "@/lib/useTeamsData";
import { useProject } from "@/lib/useProjectsData";
import { useUserProfiles } from "@/lib/useChatData";
import {
  PROJECT_ACCENTS,
  archiveProject,
  unarchiveProject,
  setProjectPhase,
} from "@/lib/projects";
import { PROJECT_PHASES } from "@/lib/schema";
import { cn } from "@/lib/utils";

import FinanceTab from "@/components/projects/FinanceTab";
import CreativeBoard from "@/components/projects/CreativeBoard";

const TABS = [
  { id: "overview", label: "Översikt", icon: LayoutDashboard },
  { id: "board", label: "Creative Board", icon: Brush },
  { id: "finance", label: "Ekonomi", icon: Wallet },
  { id: "comments", label: "Kommentarer", icon: MessageSquare },
];

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params?.projectId;
  const teamId = searchParams?.get("team");

  const { user } = useAuth();
  const toast = useToast();
  const { team, loading: teamLoading } = useTeam(teamId);
  const { project, loading: projectLoading } = useProject(teamId, projectId);

  const memberUids = project?.members || [];
  const { profiles } = useUserProfiles(memberUids);

  const [tab, setTab] = useState("overview");

  if (teamLoading || projectLoading) {
    return (
      <>
        <Header title="Projekt" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  if (!project || !team) {
    return (
      <>
        <Header title="Projekt" subtitle="// finns inte" />
        <div className="p-8 max-w-2xl mx-auto">
          <Card>
            <p className="text-sm font-body text-slate-700">
              Projektet hittades inte eller så har du inte tillgång.
            </p>
            <Button
              variant="ghost"
              onClick={() => router.replace("/projects")}
              className="mt-4"
            >
              Tillbaka till projekt
            </Button>
          </Card>
        </div>
      </>
    );
  }

  if (!user || !(project.members || []).includes(user.uid)) {
    // Caller is not a project member — could still be in team. Show
    // limited view in that case. For step 1 we just inform.
    return (
      <>
        <Header title={project.title} subtitle="// inte medlem" />
        <div className="p-8 max-w-2xl mx-auto">
          <Card>
            <p className="text-sm font-body text-slate-700">
              Du är inte medlem i projektet ännu. Be projektledaren att
              lägga till dig.
            </p>
            <Button
              variant="ghost"
              onClick={() => router.replace("/projects")}
              className="mt-4"
            >
              Tillbaka
            </Button>
          </Card>
        </div>
      </>
    );
  }

  const accent =
    PROJECT_ACCENTS.find((a) => a.id === project.coverColor) || PROJECT_ACCENTS[0];
  const phase =
    PROJECT_PHASES.find((p) => p.id === project.phase) || PROJECT_PHASES[0];

  const isArchived = project.status === "archived";

  return (
    <>
      {/* Banner */}
      <div className="px-8 pt-6 pb-6 relative" style={{ background: accent.value }}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              href={`/projects`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors"
              aria-label="Tillbaka till projekt"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-heading text-white tracking-tight truncate">
                  {project.title}
                </h1>
                {isArchived && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-mono uppercase tracking-wider">
                    <Archive className="w-2.5 h-2.5" /> Arkiverad
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 font-mono mt-1">
                {project.customerName || "Ingen kund angiven"} ·{" "}
                <PhaseSelect
                  project={project}
                  teamId={teamId}
                  isArchived={isArchived}
                />
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-2">
              {memberUids.slice(0, 5).map((uid) => {
                const p = profiles.get(uid);
                return (
                  <Avatar
                    key={uid}
                    name={p?.displayName}
                    src={p?.photoURL}
                    size="sm"
                    className="ring-2 ring-white/40"
                  />
                );
              })}
              {memberUids.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-white/20 text-white text-xs font-mono font-semibold flex items-center justify-center ring-2 ring-white/40 backdrop-blur-md">
                  +{memberUids.length - 5}
                </div>
              )}
            </div>
            {isArchived ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await unarchiveProject(teamId, projectId);
                    toast.success("Projektet är nu aktivt igen.");
                  } catch (err) {
                    toast.error(err.message || "Kunde inte avarkivera.");
                  }
                }}
              >
                Avarkivera
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                icon={Archive}
                onClick={async () => {
                  try {
                    await archiveProject(teamId, projectId);
                    toast.success("Projektet är arkiverat. Ekonomin är låst.");
                  } catch (err) {
                    toast.error(err.message || "Kunde inte arkivera.");
                  }
                }}
              >
                Arkivera
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-8 pt-4 border-b border-slate-200">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5",
                  tab === t.id
                    ? "bg-white text-[#0052FF] shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-8 animate-fade-in">
        {tab === "overview" && (
          <OverviewTab project={project} team={team} profiles={profiles} />
        )}
        {tab === "board" && (
          <CreativeBoard
            teamId={teamId}
            projectId={projectId}
            isArchived={isArchived}
          />
        )}
        {tab === "finance" && (
          <FinanceTab
            teamId={teamId}
            projectId={projectId}
            project={project}
            profilesById={profiles}
            isArchived={isArchived}
          />
        )}
        {tab === "comments" && (
          <Card padding="lg">
            <p className="text-sm font-mono text-slate-500">
              // Kommentarer kommer i steg 3.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-views
   ────────────────────────────────────────────────────────────────── */

function PhaseSelect({ project, teamId, isArchived }) {
  const toast = useToast();
  const onChange = async (newPhase) => {
    try {
      await setProjectPhase(teamId, project.id, newPhase);
      toast.success(
        `Fas uppdaterad: ${PROJECT_PHASES.find((p) => p.id === newPhase)?.label}.`
      );
    } catch (err) {
      toast.error(err.message || "Kunde inte byta fas.");
    }
  };

  if (isArchived) {
    return (
      <span className="text-white/90">
        {PROJECT_PHASES.find((p) => p.id === project.phase)?.label}
      </span>
    );
  }

  return (
    <select
      value={project.phase}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white/15 text-white text-xs font-mono px-2 py-0.5 rounded backdrop-blur-md border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
    >
      {PROJECT_PHASES.map((p) => (
        <option key={p.id} value={p.id} className="text-slate-900">
          {p.label}
        </option>
      ))}
    </select>
  );
}

function OverviewTab({ project, team, profiles }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <h2 className="text-base font-heading text-slate-900 mb-3">
          Beskrivning
        </h2>
        {project.description ? (
          <p className="text-sm font-body text-slate-700 leading-relaxed whitespace-pre-wrap">
            {project.description}
          </p>
        ) : (
          <p className="text-sm font-mono text-slate-400 italic">
            Ingen beskrivning angiven.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-heading text-slate-900 mb-3">Team</h2>
        <p className="text-xs text-slate-500 font-mono mb-3">{team.name}</p>
        <div className="space-y-2">
          {(project.members || []).map((uid) => {
            const p = profiles.get(uid);
            const isLead = project.leadUid === uid;
            return (
              <div key={uid} className="flex items-center gap-2">
                <Avatar
                  name={p?.displayName}
                  src={p?.photoURL}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-body font-semibold text-slate-900 truncate">
                    {p?.displayName || uid}
                  </p>
                  {isLead && (
                    <p className="text-[9px] text-[#0052FF] font-mono uppercase tracking-widest">
                      Projektledare
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
