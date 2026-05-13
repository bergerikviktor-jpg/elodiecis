"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";

import TaskCard from "@/components/todo/TaskCard";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Auto-derive a status dot color from the column name. Matches common
 * Swedish + English Kanban labels — anything else falls through to a
 * neutral grey. Computed at render-time so renaming a column updates
 * the dot live, no data migration needed.
 */
function statusColorFor(name) {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "#cbd5e1";
  // Done — green
  if (/(^|\s)(klar|klart|färdig|done|complete)(\s|$)/.test(n)) return "#22c55e";
  // Blocked — red
  if (/blocker|stopp|blocked/.test(n)) return "#ef4444";
  // Waiting / review / feedback — indigo
  if (/väntar|feedback|review|granskning/.test(n)) return "#6366f1";
  // In progress / doing — amber
  if (/pågående|påg|in progress|doing|igång|wip/.test(n)) return "#f59e0b";
  // To do / backlog — slate
  if (/att göra|todo|to do|att gora|backlog|att göras|kö/.test(n)) return "#64748b";
  return "#cbd5e1";
}

/**
 * A single board column. Renders its tasks as sortable + droppable
 * via dnd-kit. Header has a quick-rename and delete menu; footer has
 * an inline "lägg till uppgift" form that flips on demand.
 */
export default function Column({
  column,
  tasks,
  isOver,
  profilesById,
  onAddTask,
  onRename,
  onDelete,
  onOpenTask,
}) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });
  const taskIds = tasks.map((t) => t.id);

  // Inline edit / add forms
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(column.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === column.name) {
      setRenaming(false);
      setNewName(column.name);
      return;
    }
    await onRename?.(trimmed);
    setRenaming(false);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed || submittingTask) return;
    setSubmittingTask(true);
    try {
      await onAddTask?.(trimmed);
      setNewTaskTitle("");
      // Keep the form open for rapid task entry. User can dismiss with Esc.
    } finally {
      setSubmittingTask(false);
    }
  };

  return (
    <div className="w-80 shrink-0 flex flex-col">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        {renaming ? (
          <form
            onSubmit={handleRenameSubmit}
            className="flex-1 mr-2 flex items-center gap-2"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColorFor(newName) }}
              aria-hidden="true"
            />
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setRenaming(false);
                  setNewName(column.name);
                }
              }}
              maxLength={60}
              className="flex-1 px-2 py-1 rounded-md bg-white border border-[#0052FF] text-sm font-body font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
            />
          </form>
        ) : (
          <button
            type="button"
            onDoubleClick={() => setRenaming(true)}
            className="flex items-center gap-2 min-w-0"
            title="Dubbelklicka för att byta namn"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: statusColorFor(column.name) }}
              aria-hidden="true"
            />
            <h3 className="text-sm font-heading text-slate-900 truncate">
              {column.name}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
            aria-label="Kolumnmeny"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              {/* Click-away overlay */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setRenaming(true);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Byt namn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete?.();
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-mono text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ta bort kolumn
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Column body */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-2 p-2 rounded-2xl border min-h-[120px] transition-all duration-200",
            isOver
              ? "bg-blue-50 border-[#0052FF]/30 shadow-[0_0_20px_-8px_rgba(0,82,255,0.15)]"
              : "bg-slate-100/60 border-slate-200"
          )}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              profilesById={profilesById}
              onOpen={onOpenTask}
            />
          ))}

          {tasks.length === 0 && !adding && (
            <div className="flex items-center justify-center h-20 text-[11px] font-mono text-slate-400 border border-dashed border-slate-300 rounded-xl">
              Tom kolumn
            </div>
          )}

          {/* Inline add-task form */}
          {adding ? (
            <form onSubmit={handleAddSubmit} className="space-y-2 pt-1">
              <textarea
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAddSubmit(e);
                  } else if (e.key === "Escape") {
                    setAdding(false);
                    setNewTaskTitle("");
                  }
                }}
                placeholder="Skriv en titel..."
                rows={2}
                maxLength={200}
                disabled={submittingTask}
                className="w-full resize-none px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-body text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  type="submit"
                  loading={submittingTask}
                  disabled={!newTaskTitle.trim()}
                >
                  Lägg till
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewTaskTitle("");
                  }}
                  disabled={submittingTask}
                >
                  Avbryt
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono text-slate-500 hover:text-[#0052FF] hover:bg-white/80 border border-transparent hover:border-slate-200 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Lägg till uppgift
            </button>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
