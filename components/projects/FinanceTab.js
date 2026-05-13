"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lock,
  ExternalLink,
  Trash2,
  Pencil,
  Crown,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Toggle from "@/components/ui/Toggle";

import AddExpenseModal from "@/components/modals/AddExpenseModal";
import EditProfitShareModal from "@/components/modals/EditProfitShareModal";

import {
  useProjectExpenses,
  useProjectProfitShares,
} from "@/lib/useProjectsData";
import {
  computeProfitDistribution,
  formatSEK,
  withVAT,
} from "@/lib/profitShares";
import { deleteExpense } from "@/lib/expenses";
import { EXPENSE_CATEGORIES, SWEDISH_VAT_RATE } from "@/lib/projects";
import { PROJECT_PHASES } from "@/lib/schema";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { cn } from "@/lib/utils";

/**
 * The financial heart of a project.
 *
 *   Layer 1: Overview cards (Budget / Expenses / Net / Margin)
 *   Layer 2: Expenses list with per-phase + per-category filters
 *   Layer 3: Profit-share allocation with live computed amounts
 *
 * Everything updates realtime via Firestore listeners. The math is
 * deterministic & pure — see `computeProfitDistribution`.
 */
export default function FinanceTab({
  teamId,
  projectId,
  project,
  profilesById,
  isArchived = false,
}) {
  const { user } = useAuth();
  const toast = useToast();

  const { expenses, loading: expensesLoading } = useProjectExpenses(
    teamId,
    projectId
  );
  const { shares, loading: sharesLoading } = useProjectProfitShares(
    teamId,
    projectId
  );

  // ── Modal state ──────────────────────────────────────────────
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [editShareTarget, setEditShareTarget] = useState(null); // { uid, share|null }

  // ── VAT display toggle (UI-only) ─────────────────────────────
  const [showInclVat, setShowInclVat] = useState(false);
  const fmt = (n) =>
    formatSEK(showInclVat ? withVAT(n) : n);

  // ── Finance math ─────────────────────────────────────────────
  const distribution = useMemo(
    () =>
      computeProfitDistribution({
        totalBudget: project.totalBudget || 0,
        totalExpenses: project.totalExpenses || 0,
        shares: shares.map((s) => ({
          uid: s.uid || s.id,
          mode: s.mode,
          percent: s.percent,
          fixedAmount: s.fixedAmount,
          roleLabel: s.roleLabel,
          lockedAt: s.lockedAt,
        })),
      }),
    [project.totalBudget, project.totalExpenses, shares]
  );

  const marginPct =
    project.totalBudget > 0
      ? Math.round((distribution.netResult / project.totalBudget) * 100)
      : 0;

  // ── Per-phase expense breakdown ──────────────────────────────
  const phaseTotals = useMemo(() => {
    const totals = new Map();
    PROJECT_PHASES.forEach((p) => totals.set(p.id, 0));
    expenses.forEach((e) => {
      const p = e.phase || "pre_production";
      totals.set(p, (totals.get(p) || 0) + (e.amount || 0));
    });
    return totals;
  }, [expenses]);

  // ── Helpers ──────────────────────────────────────────────────
  const handleDeleteExpense = async (id) => {
    try {
      await deleteExpense(teamId, projectId, id);
      toast.info("Utgift borttagen.");
    } catch (err) {
      console.error("deleteExpense failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte ta bort utgiften.");
    }
  };

  const openEditShare = (uid, existingShare) => {
    setEditShareTarget({ uid, share: existingShare || null });
  };

  // Project members who don't yet have a profit share
  const membersWithoutShare = useMemo(() => {
    const haveShare = new Set(shares.map((s) => s.uid || s.id));
    return (project.members || []).filter((uid) => !haveShare.has(uid));
  }, [project.members, shares]);

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Lager 1: Overview cards ────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-heading text-slate-900">
            Ekonomisk översikt
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            // realtime · ex moms i Firestore
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Inkl moms 25%
          </span>
          <button
            type="button"
            onClick={() => setShowInclVat((v) => !v)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              showInclVat ? "bg-[#0052FF]" : "bg-slate-200"
            )}
            role="switch"
            aria-checked={showInclVat}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                showInclVat ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Budget"
          value={fmt(project.totalBudget || 0)}
          icon={Wallet}
          accent="#0052FF"
        />
        <SummaryCard
          label="Utgifter"
          value={fmt(project.totalExpenses || 0)}
          icon={Receipt}
          accent="#f59e0b"
          subtext={`${expenses.length} ${expenses.length === 1 ? "post" : "poster"}`}
        />
        <SummaryCard
          label="Netto"
          value={fmt(distribution.netResult)}
          icon={distribution.netResult >= 0 ? TrendingUp : TrendingDown}
          accent={distribution.netResult >= 0 ? "#22c55e" : "#ef4444"}
        />
        <SummaryCard
          label="Marginal"
          value={
            project.totalBudget > 0 ? `${marginPct}%` : "—"
          }
          icon={TrendingUp}
          accent={marginPct >= 30 ? "#22c55e" : marginPct >= 10 ? "#f59e0b" : "#ef4444"}
          subtext={
            project.totalBudget > 0
              ? `${fmt(distribution.netResult)} av ${fmt(project.totalBudget)}`
              : "Sätt en budget"
          }
        />
      </div>

      {/* Per-phase mini bar */}
      {project.totalExpenses > 0 && (
        <Card padding="md">
          <h3 className="text-xs font-mono font-medium text-slate-500 uppercase tracking-widest mb-3">
            Utgifter per fas
          </h3>
          <div className="space-y-2">
            {PROJECT_PHASES.map((p) => {
              const total = phaseTotals.get(p.id) || 0;
              const pct =
                project.totalExpenses > 0
                  ? (total / project.totalExpenses) * 100
                  : 0;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-mono text-slate-600 truncate">
                    {p.label}
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: p.color,
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs font-mono font-semibold text-slate-700">
                    {fmt(total)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Lager 2: Expenses list ─────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-heading text-slate-900">Utgifter</h3>
            <p className="text-[10px] text-slate-500 font-mono">
              // {expenses.length} {expenses.length === 1 ? "post" : "poster"}
            </p>
          </div>
          {!isArchived && (
            <Button
              size="sm"
              icon={Plus}
              onClick={() => setAddExpenseOpen(true)}
            >
              Lägg till utgift
            </Button>
          )}
        </div>

        {expensesLoading ? (
          <div className="px-5 py-10 text-center text-xs font-mono text-slate-400">
            Laddar...
          </div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Inga utgifter registrerade"
            description="Lägg till första utgiften för att börja spåra ekonomin. Belopp anges alltid exklusive moms."
            action={
              !isArchived ? (
                <Button icon={Plus} onClick={() => setAddExpenseOpen(true)}>
                  Lägg till utgift
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                    Datum
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                    Beskrivning
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                    Fas
                  </th>
                  <th className="text-left px-5 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                    Kategori
                  </th>
                  <th className="text-right px-5 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                    Belopp
                  </th>
                  <th className="text-center px-5 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                    Kvitto
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map((exp) => (
                  <ExpenseRow
                    key={exp.id}
                    expense={exp}
                    fmt={fmt}
                    onDelete={() => handleDeleteExpense(exp.id)}
                    canEdit={!isArchived}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Lager 3: Profit sharing ────────────────────────────── */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-heading text-slate-900">
              Vinstfördelning
            </h3>
            <p className="text-[10px] text-slate-500 font-mono">
              // {shares.length} {shares.length === 1 ? "deltagare" : "deltagare"} ·{" "}
              {isArchived ? "låst" : "förhandsvisning"}
            </p>
          </div>
          {!isArchived && membersWithoutShare.length > 0 && (
            <div className="relative inline-block">
              <AddMemberShareButton
                members={membersWithoutShare}
                profilesById={profilesById}
                onPick={(uid) => openEditShare(uid, null)}
              />
            </div>
          )}
        </div>

        {/* Warnings */}
        {(distribution.warnings.overPercent ||
          distribution.warnings.fixedExceedsNet ||
          distribution.warnings.negativeNet) && (
          <div className="px-5 py-3 border-b border-slate-100 bg-amber-50/50 space-y-1">
            {distribution.warnings.overPercent && (
              <WarningRow
                tone="red"
                text={`Procentpoolen är över-allokerad: ${distribution.totalPercent}% (max 100%).`}
              />
            )}
            {distribution.warnings.fixedExceedsNet && (
              <WarningRow
                tone="amber"
                text={`Fasta belopp (${formatSEK(distribution.totalFixed)}) överskrider nettot. Procentandelar blir 0 kr.`}
              />
            )}
            {distribution.warnings.negativeNet && (
              <WarningRow
                tone="red"
                text={`Projektet visar förlust. Procentandelar blir 0 kr; fasta belopp förblir skulder.`}
              />
            )}
          </div>
        )}

        {/* Allocations */}
        {sharesLoading ? (
          <div className="px-5 py-10 text-center text-xs font-mono text-slate-400">
            Laddar...
          </div>
        ) : distribution.allocations.length === 0 ? (
          <EmptyState
            icon={Crown}
            title="Ingen vinstfördelning satt"
            description="Lägg till projektmedlemmar och tilldela en procentandel eller ett fast belopp för var och en."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {distribution.allocations.map((a) => (
              <AllocationRow
                key={a.uid}
                allocation={a}
                profile={profilesById?.get(a.uid)}
                fmt={fmt}
                onEdit={() =>
                  openEditShare(
                    a.uid,
                    shares.find((s) => (s.uid || s.id) === a.uid)
                  )
                }
                canEdit={!isArchived && !a.lockedAt}
              />
            ))}

            {/* Company remainder */}
            {distribution.unallocatedToCompany > 0 &&
              distribution.totalPercent < 100 && (
                <div className="px-5 py-3 flex items-center gap-3 bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-body font-medium text-slate-700">
                      Företaget (rest)
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {(100 - distribution.totalPercent).toFixed(0)}% av kvarvarande pool
                    </p>
                  </div>
                  <p className="text-sm font-mono font-semibold text-slate-700">
                    {fmt(distribution.unallocatedToCompany)}
                  </p>
                </div>
              )}
          </div>
        )}

        {/* Summary footer */}
        {distribution.allocations.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
            <span className="text-slate-500">
              Allokerat: <span className="font-semibold text-slate-900">{distribution.totalPercent}%</span>
              {" · "}Fast: <span className="font-semibold text-slate-900">{formatSEK(distribution.totalFixed)}</span>
            </span>
            <span className="text-slate-500 inline-flex items-center gap-1.5">
              {isArchived ? (
                <>
                  <Lock className="w-3 h-3" />
                  Låst {project.archivedAt
                    ? `· ${new Date(
                        project.archivedAt.toDate
                          ? project.archivedAt.toDate()
                          : project.archivedAt
                      ).toLocaleDateString("sv-SE")}`
                    : ""}
                </>
              ) : (
                "ℹ Förhandsvisning — uppdateras live vid ändringar"
              )}
            </span>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddExpenseModal
        isOpen={addExpenseOpen}
        onClose={() => setAddExpenseOpen(false)}
        teamId={teamId}
        projectId={projectId}
        defaultPhase={project.phase}
      />

      <EditProfitShareModal
        isOpen={!!editShareTarget}
        onClose={() => setEditShareTarget(null)}
        teamId={teamId}
        projectId={projectId}
        uid={editShareTarget?.uid}
        existingShare={editShareTarget?.share}
        memberProfile={profilesById?.get(editShareTarget?.uid)}
        netResult={distribution.netResult}
        totalFixed={distribution.totalFixed}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function SummaryCard({ label, value, icon: Icon, accent, subtext }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
            {label}
          </p>
          <p className="text-2xl font-heading text-slate-900 tracking-tight mt-1 truncate">
            {value}
          </p>
          {subtext && (
            <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
              {subtext}
            </p>
          )}
        </div>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </Card>
  );
}

function ExpenseRow({ expense, fmt, onDelete, canEdit }) {
  const phase = PROJECT_PHASES.find((p) => p.id === expense.phase) || PROJECT_PHASES[0];
  const category = EXPENSE_CATEGORIES.find((c) => c.id === expense.category);
  const dateStr = expense.expenseDate
    ? new Date(
        expense.expenseDate.toDate
          ? expense.expenseDate.toDate()
          : expense.expenseDate
      ).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })
    : "—";

  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-5 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">
        {dateStr}
      </td>
      <td className="px-5 py-3 min-w-0">
        <p className="text-sm font-body font-medium text-slate-900 truncate">
          {expense.description}
        </p>
        {(expense.vendorName || expense.invoiceNumber) && (
          <p className="text-[10px] text-slate-400 font-mono truncate">
            {expense.vendorName}
            {expense.vendorName && expense.invoiceNumber ? " · " : ""}
            {expense.invoiceNumber}
          </p>
        )}
      </td>
      <td className="px-5 py-3">
        <Badge color={phase.color} size="xs">
          {phase.label}
        </Badge>
      </td>
      <td className="px-5 py-3 text-xs font-mono text-slate-600">
        {category?.label || "—"}
      </td>
      <td className="px-5 py-3 text-right text-sm font-mono font-semibold text-slate-900 whitespace-nowrap">
        {fmt(expense.amount || 0)}
      </td>
      <td className="px-5 py-3 text-center">
        {expense.receiptUrl ? (
          <a
            href={expense.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
            title={expense.receiptFilename || "Visa kvitto"}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : (
          <span className="text-[10px] font-mono text-slate-300">—</span>
        )}
      </td>
      <td className="px-3">
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            aria-label="Ta bort utgift"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function AllocationRow({ allocation, profile, fmt, onEdit, canEdit }) {
  return (
    <div className="px-5 py-3 flex items-center gap-3 group">
      <Avatar
        name={profile?.displayName}
        src={profile?.photoURL}
        size="md"
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-body font-semibold text-slate-900 truncate">
            {profile?.displayName || allocation.uid}
          </p>
          {allocation.roleLabel && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {allocation.roleLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {allocation.mode === "fixed" ? (
            <span className="text-[10px] font-mono text-slate-500">
              Fast belopp
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-500">
              {allocation.percent}% av pool
            </span>
          )}
          {allocation.lockedAt && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
              <Lock className="w-2.5 h-2.5" />
              Låst
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-mono font-semibold text-[#0052FF]">
          {fmt(allocation.computedAmount)}
        </p>
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all"
          aria-label="Redigera andel"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function AddMemberShareButton({ members, profilesById, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" icon={Plus} onClick={() => setOpen((o) => !o)}>
        Lägg till deltagare
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
            <div className="max-h-64 overflow-y-auto">
              {members.map((uid) => {
                const p = profilesById?.get(uid);
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onPick(uid);
                    }}
                    className="w-full text-left px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <Avatar
                      name={p?.displayName}
                      src={p?.photoURL}
                      size="xs"
                    />
                    <span className="text-xs font-body font-semibold text-slate-900 truncate">
                      {p?.displayName || uid}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function WarningRow({ tone, text }) {
  const colorMap = {
    red: "text-red-700",
    amber: "text-amber-700",
  };
  return (
    <div className={cn("flex items-start gap-2 text-xs font-mono", colorMap[tone])}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
