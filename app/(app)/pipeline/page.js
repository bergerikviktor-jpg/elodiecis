"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, ChevronDown, UsersRound, Loader2 } from "lucide-react";

import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import NewDealModal from "@/components/modals/NewDealModal";
import DealDetailModal from "@/components/modals/DealDetailModal";
import PipelineColumn from "@/components/pipeline/PipelineColumn";
import DealCard from "@/components/pipeline/DealCard";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTeams, useTeam } from "@/lib/useTeamsData";
import { useDeals } from "@/lib/useDealsData";
import { useUserProfiles } from "@/lib/useChatData";
import { persistStageOrder, persistCrossStageMove } from "@/lib/deals";
import { DEAL_STAGES } from "@/lib/schema";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const LAST_TEAM_STORAGE_KEY_PREFIX = "elodie:pipeline:lastTeamId:";

/**
 * Use pointer-within first, then rect intersection — same as
 * todolist/[boardId]. Lets users drop into empty stages reliably.
 */
function customCollisionDetection(args) {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return rectIntersection(args);
}

export default function PipelinePage() {
  const { user } = useAuth();
  const toast = useToast();
  const { teams, loading: teamsLoading } = useTeams(user?.uid);

  // ── Team selection (persisted in localStorage per user) ───────
  const storageKey = user ? `${LAST_TEAM_STORAGE_KEY_PREFIX}${user.uid}` : null;
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Initial restore from localStorage (run once per user).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) setSelectedTeamId(cached);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [storageKey]);

  // Auto-pick + validate against current memberships:
  //  - If no selection and teams loaded → pick first
  //  - If selection points at a team I'm no longer in → clear
  useEffect(() => {
    if (teamsLoading) return;
    if (teams.length === 0) {
      if (selectedTeamId !== null) setSelectedTeamId(null);
      return;
    }
    const stillMember = selectedTeamId
      ? teams.some((t) => t.id === selectedTeamId)
      : false;
    if (!stillMember) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teamsLoading, teams, selectedTeamId]);

  // Persist selection.
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (selectedTeamId) {
        localStorage.setItem(storageKey, selectedTeamId);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, selectedTeamId]);

  // ── Data for the selected team ────────────────────────────────
  const { team } = useTeam(selectedTeamId);
  const { deals: firestoreDeals, loading: dealsLoading } = useDeals(selectedTeamId);

  // Local mirror so drag operations feel instant (re-sync from
  // Firestore on every snapshot).
  const [deals, setDeals] = useState(firestoreDeals);
  useEffect(() => setDeals(firestoreDeals), [firestoreDeals]);

  // Member profiles for owner-avatars on cards
  const memberUids = team?.members || [];
  const { profiles: profilesById } = useUserProfiles(memberUids);

  // ── Modal state ───────────────────────────────────────────────
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [openDealId, setOpenDealId] = useState(null);

  // Resolve the open-deal from the live `deals` array so realtime
  // updates flow through to the detail modal (e.g. other team member
  // edits a field while you have it open).
  const openDeal = useMemo(
    () => (openDealId ? deals.find((d) => d.id === openDealId) : null),
    [openDealId, deals]
  );

  // Auto-close the modal if the deal disappears (deleted by someone else).
  useEffect(() => {
    if (openDealId && !openDeal && !dealsLoading) {
      setOpenDealId(null);
    }
  }, [openDealId, openDeal, dealsLoading]);

  // ── Group deals by stage ──────────────────────────────────────
  const dealsByStage = useMemo(() => {
    const m = new Map();
    DEAL_STAGES.forEach((s) => m.set(s.id, []));
    deals.forEach((d) => {
      const stageId = d.stage || "lead";
      if (!m.has(stageId)) m.set(stageId, []);
      m.get(stageId).push(d);
    });
    for (const [, list] of m) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return m;
  }, [deals]);

  const totalPipelineValue = useMemo(
    () => deals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0),
    [deals]
  );

  // ── DnD ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeId, setActiveId] = useState(null);
  const [overStageId, setOverStageId] = useState(null);

  const findStageOfDeal = (dealId) => {
    const d = deals.find((x) => x.id === dealId);
    return d?.stage || null;
  };

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragOver = (event) => {
    const { over } = event;
    if (!over) return setOverStageId(null);
    const overStage = DEAL_STAGES.some((s) => s.id === over.id)
      ? over.id
      : findStageOfDeal(over.id);
    setOverStageId(overStage);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setOverStageId(null);
    if (!over || !selectedTeamId) return;

    const activeDealId = active.id;
    const activeStage = findStageOfDeal(activeDealId);
    if (!activeStage) return;

    const overStage = DEAL_STAGES.some((s) => s.id === over.id)
      ? over.id
      : findStageOfDeal(over.id);
    if (!overStage) return;

    if (activeStage === overStage) {
      // Reorder within same stage.
      const stageDeals = dealsByStage.get(activeStage) || [];
      const oldIdx = stageDeals.findIndex((d) => d.id === activeDealId);
      let newIdx;
      if (over.id === activeStage) {
        newIdx = stageDeals.length - 1;
      } else {
        newIdx = stageDeals.findIndex((d) => d.id === over.id);
      }
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;

      const reordered = arrayMove(stageDeals, oldIdx, newIdx);
      setDeals((prev) => mergeStage(prev, activeStage, reordered));
      try {
        await persistStageOrder(selectedTeamId, activeStage, reordered);
      } catch (err) {
        console.error("persistStageOrder failed", err);
        toast.error("Kunde inte spara ordningen.");
      }
      return;
    }

    // Cross-stage move
    const sourceDeals = (dealsByStage.get(activeStage) || []).filter(
      (d) => d.id !== activeDealId
    );
    const destDealsOld = dealsByStage.get(overStage) || [];
    const movedDeal = deals.find((d) => d.id === activeDealId);
    if (!movedDeal) return;
    const updatedMoved = { ...movedDeal, stage: overStage };

    let insertAt = destDealsOld.length;
    if (over.id !== overStage) {
      const idx = destDealsOld.findIndex((d) => d.id === over.id);
      if (idx >= 0) insertAt = idx;
    }
    const destDeals = [
      ...destDealsOld.slice(0, insertAt),
      updatedMoved,
      ...destDealsOld.slice(insertAt),
    ];

    setDeals((prev) => {
      const next = mergeStage(prev, activeStage, sourceDeals);
      return mergeStage(next, overStage, destDeals);
    });

    try {
      await persistCrossStageMove(selectedTeamId, {
        dealId: activeDealId,
        fromStage: activeStage,
        toStage: overStage,
        newSourceDeals: sourceDeals,
        newDestDeals: destDeals,
      });
    } catch (err) {
      console.error("persistCrossStageMove failed", err);
      toast.error("Kunde inte spara flytten.");
    }
  };

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  // ── Render guards ─────────────────────────────────────────────
  if (teamsLoading) {
    return (
      <>
        <Header title="Pipeline" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  if (teams.length === 0) {
    return (
      <>
        <Header title="Pipeline" subtitle="// inga team än" />
        <div className="p-8 max-w-2xl mx-auto">
          <Card padding="none">
            <EmptyState
              icon={UsersRound}
              title="Du måste tillhöra ett team"
              description="Pipelinen är teambaserad. Skapa eller acceptera en inbjudan till ett team för att börja lägga in affärer."
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
        title="Pipeline"
        subtitle={
          dealsLoading
            ? "// laddar..."
            : `// ${team?.name || ""} · totalt_värde: ${formatCurrency(totalPipelineValue)} · ${deals.length} affärer`
        }
        actions={
          <Button
            icon={Plus}
            size="md"
            onClick={() => setNewDealOpen(true)}
            disabled={!selectedTeamId}
          >
            Ny affär
          </Button>
        }
      />

      {/* Team picker — under header, before kanban */}
      <div className="px-8 pt-4">
        <TeamPicker
          teams={teams}
          value={selectedTeamId}
          onChange={setSelectedTeamId}
        />
      </div>

      {/* Kanban */}
      <div className="px-8 pt-4 pb-8 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max pb-4">
            {DEAL_STAGES.map((stage) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) || []}
                isOver={overStageId === stage.id}
                profilesById={profilesById}
                onOpenDeal={(d) => setOpenDealId(d.id)}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
            {activeDeal ? (
              <div className="w-72 rotate-[2deg] opacity-95">
                <DealCard
                  deal={activeDeal}
                  ownerProfile={profilesById.get(activeDeal.ownerUid)}
                  onOpen={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <NewDealModal
        isOpen={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        team={team}
        defaultStage="lead"
      />

      <DealDetailModal
        isOpen={!!openDeal}
        onClose={() => setOpenDealId(null)}
        deal={openDeal}
        teamId={selectedTeamId}
        team={team}
        profilesById={profilesById}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   TeamPicker — small inline dropdown for switching teams
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
                    <p className="text-[10px] text-slate-500 font-mono truncate">
                      {(t.memberCount ?? t.members?.length ?? 0)}{" "}
                      {(t.memberCount ?? t.members?.length ?? 0) === 1
                        ? "medlem"
                        : "medlemmar"}
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

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function mergeStage(allDeals, stageId, newStageDeals) {
  // Replace all deals belonging to `stageId` with the new ordered list,
  // updating each one's stage + order field. Deals in OTHER stages are
  // untouched.
  const orderedIds = new Set(newStageDeals.map((d) => d.id));
  const others = allDeals.filter(
    (d) => d.stage !== stageId && !orderedIds.has(d.id)
  );
  const updated = newStageDeals.map((d, i) => ({
    ...d,
    stage: stageId,
    order: i,
  }));
  return [...others, ...updated];
}
