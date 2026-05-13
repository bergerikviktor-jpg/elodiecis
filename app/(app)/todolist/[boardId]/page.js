"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import {
  ArrowLeft,
  Plus,
  Search,
  UserPlus,
  Trash2,
  ChevronLeft,
  Loader2,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Column from "@/components/todo/Column";
import TaskCard from "@/components/todo/TaskCard";
import TaskModal from "@/components/todo/TaskModal";
import InviteToBoardModal from "@/components/modals/InviteToBoardModal";
import DeleteBoardModal from "@/components/modals/DeleteBoardModal";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { useBoard, useColumns, useTasks } from "@/lib/useTodoData";
import {
  BOARD_BACKGROUNDS,
  createColumn,
  createTask,
  deleteColumnAndTasks,
  persistColumnOrder,
  persistCrossColumnMove,
  renameColumn,
} from "@/lib/todo";

/**
 * Custom collision detection — prefer pointer-within over rect-
 * intersection so users can drop tasks "into" empty columns
 * reliably. Same pattern as the pipeline page.
 */
function customCollisionDetection(args) {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
}

export default function BoardPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params?.boardId;

  const { user } = useAuth();
  const toast = useToast();

  const { board, loading: boardLoading } = useBoard(boardId);
  const { columns, loading: columnsLoading } = useColumns(boardId);
  const { tasks: firestoreTasks, loading: tasksLoading } = useTasks(boardId);

  // ── Local tasks state so drag operations feel instant ─────────
  // Synced from Firestore. During a drag we mutate locally and
  // persist async; the next snapshot updates this back to truth.
  const [tasks, setTasks] = useState(firestoreTasks);
  useEffect(() => setTasks(firestoreTasks), [firestoreTasks]);

  // ── Member profiles ───────────────────────────────────────────
  const memberUids = board?.members || [];
  const { profiles: profilesById } = useUserProfiles(memberUids);

  // ── Search filter ─────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const visibleTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        (t.title || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  // Group tasks by column. Each column's tasks are sorted by order.
  const tasksByColumn = useMemo(() => {
    const m = new Map();
    columns.forEach((c) => m.set(c.id, []));
    visibleTasks.forEach((t) => {
      if (!m.has(t.columnId)) m.set(t.columnId, []);
      m.get(t.columnId).push(t);
    });
    for (const [, list] of m) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return m;
  }, [columns, visibleTasks]);

  // ── DnD state ─────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const [activeId, setActiveId] = useState(null);
  const [overColumnId, setOverColumnId] = useState(null);

  const findColumnOfTask = (taskId) => {
    const t = tasks.find((x) => x.id === taskId);
    return t?.columnId || null;
  };

  const handleDragStart = (event) => setActiveId(event.active.id);

  const handleDragOver = (event) => {
    const { over } = event;
    if (!over) return setOverColumnId(null);
    // If hovering over a column → set directly. If hovering over a
    // task → find that task's column.
    const overCol = columns.some((c) => c.id === over.id)
      ? over.id
      : findColumnOfTask(over.id);
    setOverColumnId(overCol);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);
    if (!over) return;

    const activeTaskId = active.id;
    const activeCol = findColumnOfTask(activeTaskId);
    if (!activeCol) return;

    // The target is either a column or a task — resolve to a columnId.
    const overCol = columns.some((c) => c.id === over.id)
      ? over.id
      : findColumnOfTask(over.id);
    if (!overCol) return;

    if (activeCol === overCol) {
      // Reorder within the same column.
      const colTasks = tasksByColumn.get(activeCol) || [];
      const oldIdx = colTasks.findIndex((t) => t.id === activeTaskId);
      // If `over.id` is a column, drop at end. If it's a task, swap with that task's index.
      let newIdx;
      if (over.id === activeCol) {
        newIdx = colTasks.length - 1;
      } else {
        newIdx = colTasks.findIndex((t) => t.id === over.id);
      }
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return;

      const reordered = arrayMove(colTasks, oldIdx, newIdx);

      // Optimistic local update.
      setTasks((prev) => mergeColumn(prev, activeCol, reordered));

      try {
        await persistColumnOrder(boardId, activeCol, reordered);
      } catch (err) {
        console.error("persistColumnOrder failed", err);
        toast.error("Kunde inte spara ordningen.");
      }
      return;
    }

    // Cross-column move.
    const sourceTasks = (tasksByColumn.get(activeCol) || []).filter(
      (t) => t.id !== activeTaskId
    );
    const destTasksOld = tasksByColumn.get(overCol) || [];

    const movedTask = tasks.find((t) => t.id === activeTaskId);
    if (!movedTask) return;
    const updatedMoved = { ...movedTask, columnId: overCol };

    // If we dropped on a specific task in the destination, insert at its index.
    let insertAt = destTasksOld.length;
    if (over.id !== overCol) {
      const idx = destTasksOld.findIndex((t) => t.id === over.id);
      if (idx >= 0) insertAt = idx;
    }
    const destTasks = [
      ...destTasksOld.slice(0, insertAt),
      updatedMoved,
      ...destTasksOld.slice(insertAt),
    ];

    // Optimistic local update.
    setTasks((prev) => {
      const next = mergeColumn(prev, activeCol, sourceTasks);
      return mergeColumn(next, overCol, destTasks);
    });

    try {
      await persistCrossColumnMove(boardId, {
        taskId: activeTaskId,
        fromColumnId: activeCol,
        toColumnId: overCol,
        newSourceTasks: sourceTasks,
        newDestTasks: destTasks,
      });
    } catch (err) {
      console.error("persistCrossColumnMove failed", err);
      toast.error("Kunde inte spara flytten.");
    }
  };

  // ── Header actions ────────────────────────────────────────────
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteBoardOpen, setDeleteBoardOpen] = useState(false);
  const [deletingColumn, setDeletingColumn] = useState(null); // columnId being deleted

  const handleAddColumn = async () => {
    if (!boardId) return;
    try {
      await createColumn(boardId, { name: "Ny kolumn", order: columns.length });
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Kunde inte skapa kolumnen.");
    }
  };

  const handleAddTask = async (columnId, title) => {
    if (!boardId || !user) return;
    const order = (tasksByColumn.get(columnId)?.length) || 0;
    await createTask(boardId, {
      columnId,
      title,
      creatorUid: user.uid,
      order,
    });
  };

  const handleDeleteColumn = async (columnId) => {
    if (!boardId) return;
    setDeletingColumn(columnId);
    try {
      await deleteColumnAndTasks(boardId, columnId);
      toast.success("Kolumnen raderades.");
    } catch (err) {
      console.error("deleteColumn failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte radera kolumnen.");
    } finally {
      setDeletingColumn(null);
    }
  };

  // ── Task modal ────────────────────────────────────────────────
  const [openTaskId, setOpenTaskId] = useState(null);
  const openTask = useMemo(
    () => (openTaskId ? tasks.find((t) => t.id === openTaskId) : null),
    [openTaskId, tasks]
  );

  // ── Render ────────────────────────────────────────────────────
  const bg =
    BOARD_BACKGROUNDS.find((b) => b.id === board?.background) ||
    BOARD_BACKGROUNDS[0];

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;
  const isCreator = user && board && board.createdBy === user.uid;

  if (boardLoading || !board) {
    return (
      <>
        <Header title="Board" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      {/* Banner / topbar */}
      <div
        className="px-8 pt-6 pb-5 relative"
        style={{ background: bg.value }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/todolist"
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors"
              aria-label="Tillbaka till boards"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-heading text-white tracking-tight truncate">
                {board.name}
              </h1>
              <p className="text-xs text-white/70 font-mono mt-0.5">
                {memberUids.length} {memberUids.length === 1 ? "medlem" : "medlemmar"} ·{" "}
                {tasks.length} {tasks.length === 1 ? "uppgift" : "uppgifter"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Member avatars */}
            <div className="flex items-center -space-x-2 mr-2">
              {memberUids.slice(0, 5).map((uid) => {
                const p = profilesById.get(uid);
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

            {/* Search */}
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors"
              aria-label="Sök uppgifter"
            >
              <Search className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-mono font-medium transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Bjud in
            </button>

            {isCreator && (
              <button
                type="button"
                onClick={() => setDeleteBoardOpen(true)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-red-500/30 backdrop-blur-md text-white transition-colors"
                aria-label="Radera board"
                title="Radera board"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {searchOpen && (
          <div className="relative mt-4 animate-slide-in-up">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sök bland uppgifter..."
              autoFocus
              className="w-full max-w-md pl-9 pr-3 py-2 rounded-lg bg-white/95 border border-white/30 text-sm text-slate-900 placeholder:text-slate-400 backdrop-blur-md focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
            />
          </div>
        )}

      </div>

      {/* Board body — horizontally scrolling columns */}
      <div className="overflow-x-auto px-6 py-6">
        {columnsLoading || tasksLoading ? (
          <BoardSkeleton />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 min-w-max pb-4">
              {columns.map((c) => (
                <Column
                  key={c.id}
                  column={c}
                  tasks={tasksByColumn.get(c.id) || []}
                  isOver={overColumnId === c.id}
                  profilesById={profilesById}
                  onAddTask={(title) => handleAddTask(c.id, title)}
                  onRename={(name) => renameColumn(boardId, c.id, name)}
                  onDelete={() => handleDeleteColumn(c.id)}
                  onOpenTask={(t) => setOpenTaskId(t.id)}
                />
              ))}

              {/* Add-column button */}
              <button
                type="button"
                onClick={handleAddColumn}
                className="w-80 shrink-0 self-start mt-7 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border-2 border-dashed border-slate-300 text-xs font-mono text-slate-500 hover:text-[#0052FF] hover:border-[#0052FF]/50 hover:bg-blue-50/50 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Lägg till kolumn
              </button>
            </div>

            <DragOverlay dropAnimation={{ duration: 200, easing: "ease-out" }}>
              {activeTask ? (
                <div className="w-72 rotate-[2deg] opacity-95">
                  <TaskCard
                    task={activeTask}
                    profilesById={profilesById}
                    onOpen={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Modals */}
      <TaskModal
        isOpen={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        task={openTask}
        boardId={boardId}
        members={memberUids}
        profilesById={profilesById}
      />
      <InviteToBoardModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        board={board}
      />
      <DeleteBoardModal
        isOpen={deleteBoardOpen}
        onClose={() => setDeleteBoardOpen(false)}
        board={board}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function mergeColumn(allTasks, columnId, newColumnTasks) {
  // Replace all tasks belonging to `columnId` with the new ordered list,
  // updating each one's order field. Tasks in OTHER columns are untouched.
  const orderedIds = new Set(newColumnTasks.map((t) => t.id));
  const others = allTasks.filter(
    (t) => t.columnId !== columnId && !orderedIds.has(t.id)
  );
  const updated = newColumnTasks.map((t, i) => ({
    ...t,
    columnId,
    order: i,
  }));
  return [...others, ...updated];
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 min-w-max pb-4 animate-pulse">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="w-80 shrink-0">
          <div className="h-5 w-1/3 rounded bg-slate-200 mb-3" />
          <div className="rounded-2xl bg-slate-100 border border-slate-200 p-2 space-y-2">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="h-16 rounded-xl bg-slate-200" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
