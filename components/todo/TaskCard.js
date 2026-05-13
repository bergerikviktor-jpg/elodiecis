"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  CheckSquare,
  MessageSquare,
  AlertCircle,
} from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import { LABEL_CATALOG } from "@/lib/todo";
import { cn } from "@/lib/utils";

/**
 * Sortable task card rendered inside a column. Pulls visual cues
 * from the task data: labels, due date status, checklist progress,
 * and assigned members.
 */
export default function TaskCard({ task, profilesById, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  // Resolve label catalog entries from stored ids.
  const labels = useMemo(
    () =>
      (task.labels || [])
        .map((id) => LABEL_CATALOG.find((l) => l.id === id))
        .filter(Boolean),
    [task.labels]
  );

  // Checklist progress.
  const checklist = task.checklist || [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const checklistTotal = checklist.length;

  // Due date classification.
  const dueInfo = useMemo(() => classifyDueDate(task.dueDate), [task.dueDate]);

  const assignedProfiles = useMemo(
    () =>
      (task.assignedUsers || [])
        .map((uid) => profilesById?.get(uid))
        .filter(Boolean),
    [task.assignedUsers, profilesById]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Don't fire onOpen on the drag pointerdown that bubbles up —
        // dnd-kit's pointer sensor uses an 8px activation threshold so
        // pure clicks never become drags, but we still need to ignore
        // events on drag-in-progress.
        if (isDragging) return;
        onOpen?.(task);
      }}
      className={cn(
        "group p-3 rounded-xl bg-white border border-slate-200 shadow-sm cursor-pointer",
        "transition-all duration-200",
        isDragging
          ? "opacity-30 scale-95"
          : "hover:-translate-y-0.5 hover:border-[#0052FF]/30 hover:shadow-md"
      )}
    >
      {/* Labels strip */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm font-body font-medium text-slate-900 leading-snug group-hover:text-[#0052FF] transition-colors">
        {task.title}
      </p>

      {/* Meta row: due date, checklist count, comments count */}
      {(dueInfo || checklistTotal > 0 || (task.commentsCount || 0) > 0) && (
        <div className="flex items-center flex-wrap gap-2 mt-3 text-[10px] font-mono">
          {dueInfo && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
                dueInfo.tone === "overdue"
                  ? "text-red-700 bg-red-50 border border-red-200"
                  : dueInfo.tone === "today"
                  ? "text-amber-700 bg-amber-50 border border-amber-200"
                  : "text-slate-600 bg-slate-50 border border-slate-200"
              )}
            >
              {dueInfo.tone === "overdue" ? (
                <AlertCircle className="w-2.5 h-2.5" />
              ) : (
                <CalendarDays className="w-2.5 h-2.5" />
              )}
              {dueInfo.label}
            </span>
          )}
          {checklistTotal > 0 && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border",
                checklistDone === checklistTotal
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                  : "text-slate-600 bg-slate-50 border-slate-200"
              )}
            >
              <CheckSquare className="w-2.5 h-2.5" />
              {checklistDone}/{checklistTotal}
            </span>
          )}
          {(task.commentsCount || 0) > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-600 bg-slate-50 border border-slate-200">
              <MessageSquare className="w-2.5 h-2.5" />
              {task.commentsCount}
            </span>
          )}
        </div>
      )}

      {/* Assigned members */}
      {assignedProfiles.length > 0 && (
        <div className="flex items-center -space-x-1.5 mt-3">
          {assignedProfiles.slice(0, 4).map((p) => (
            <Avatar
              key={p.id}
              name={p.displayName}
              src={p.photoURL}
              size="xs"
              className="ring-2 ring-white"
            />
          ))}
          {assignedProfiles.length > 4 && (
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-mono font-semibold flex items-center justify-center ring-2 ring-white">
              +{assignedProfiles.length - 4}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Public helper — also used by TaskModal to show the same due-date
 * label inline. Returns { label, tone } where tone classifies UI
 * severity (overdue / today / future).
 */
export function classifyDueDate(due) {
  if (!due) return null;
  const date = due.toDate ? due.toDate() : new Date(due);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const oneDay = 86_400_000;
  const diffDays = Math.round((target.getTime() - today.getTime()) / oneDay);

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: overdueDays === 1 ? "Försenad 1 dag" : `Försenad ${overdueDays} dagar`,
      tone: "overdue",
    };
  }
  if (diffDays === 0) return { label: "Förfaller idag", tone: "today" };
  if (diffDays === 1) return { label: "1 dag kvar", tone: "soon" };
  if (diffDays <= 7) return { label: `${diffDays} dagar kvar`, tone: "soon" };
  return {
    label: date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }),
    tone: "future",
  };
}
