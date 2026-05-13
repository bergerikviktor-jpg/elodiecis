"use client";

import Link from "next/link";
import {
  Briefcase,
  FolderKanban,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import { useClientDeals, useClientProjects } from "@/lib/useClientsData";
import { DEAL_STAGES, PROJECT_PHASES } from "@/lib/schema";
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils";

/**
 * Read-only översikt över affärer + projekt kopplade till kunden.
 *
 * Skapande/redigering sker på respektive sida (/pipeline, /projects)
 * — vi länkar dit. När deals/projects-CRUD utökas med en `clientId`-
 * picker syns det här automatiskt.
 */
export default function ProjectsTab({ client, teamId }) {
  const { deals, loading: dealsLoading } = useClientDeals(teamId, client.id);
  const { projects, loading: projectsLoading } = useClientProjects(teamId, client.id);

  return (
    <div className="max-w-6xl space-y-8">
      {/* Affärer */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-body font-bold text-slate-900 inline-flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-500" />
            Affärer
            <span className="text-xs font-mono font-normal text-slate-400">
              {deals.length}
            </span>
          </h3>
          <Link
            href="/pipeline"
            className="text-xs font-mono text-slate-500 hover:text-[#0052FF] inline-flex items-center gap-1"
          >
            Pipeline <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {dealsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#0052FF] animate-spin" />
          </div>
        ) : deals.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Briefcase}
              title="Inga affärer kopplade"
              description="Affärer länkas till en kund via fältet kund i pipeline-modalen."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deals.map((d) => (
              <DealItem key={d.id} deal={d} />
            ))}
          </div>
        )}
      </section>

      {/* Projekt */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-body font-bold text-slate-900 inline-flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-slate-500" />
            Projekt
            <span className="text-xs font-mono font-normal text-slate-400">
              {projects.length}
            </span>
          </h3>
          <Link
            href="/projects"
            className="text-xs font-mono text-slate-500 hover:text-[#0052FF] inline-flex items-center gap-1"
          >
            Alla projekt <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        {projectsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#0052FF] animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={FolderKanban}
              title="Inga projekt kopplade"
              description="Projekt länkas till en kund via fältet kund i projektmodalen."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((p) => (
              <ProjectItem key={p.id} project={p} teamId={teamId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Item-renderers
   ────────────────────────────────────────────────────────────────── */

function DealItem({ deal }) {
  const stage = DEAL_STAGES.find((s) => s.id === deal.stage) || DEAL_STAGES[0];
  return (
    <Card hover className="group">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-body font-semibold text-slate-900 truncate">
            {deal.projectName || "Namnlös affär"}
          </p>
          <p className="text-xs text-slate-500 font-mono truncate">
            {deal.customerName}
          </p>
        </div>
        <Badge color={stage.color} size="xs">
          {stage.label}
        </Badge>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-mono">
        <span className="text-slate-500">
          {formatCurrency(deal.estimatedValue || 0)}
        </span>
        <span className="text-slate-400">
          {formatRelativeTime(deal.updatedAt || deal.createdAt)}
        </span>
      </div>
    </Card>
  );
}

function ProjectItem({ project, teamId }) {
  const phase = PROJECT_PHASES.find((p) => p.id === project.phase) || PROJECT_PHASES[0];
  return (
    <Link href={`/projects/${project.id}?team=${teamId}`}>
      <Card hover className="group">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-semibold text-slate-900 truncate group-hover:text-[#0052FF] transition-colors">
              {project.title}
            </p>
            {project.customerName && (
              <p className="text-xs text-slate-500 font-mono truncate">
                {project.customerName}
              </p>
            )}
          </div>
          <Badge color={phase.color} size="xs">
            {phase.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs font-mono">
          <span className="text-slate-500">
            {formatCurrency(project.totalBudget || 0)}
          </span>
          <span className="text-slate-400">
            {formatRelativeTime(project.updatedAt || project.createdAt)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
