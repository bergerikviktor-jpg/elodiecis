"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Timestamp } from "firebase/firestore";
import {
  CalendarDays,
  CheckSquare,
  Tag,
  Users,
  MessageSquare,
  Trash2,
  Plus,
  Send,
  Check,
  X,
  Loader2,
  Square,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTaskComments } from "@/lib/useTodoData";
import {
  LABEL_CATALOG,
  addComment,
  deleteTask,
  updateTask,
} from "@/lib/todo";
import { formatRelativeTime, cn } from "@/lib/utils";
import { classifyDueDate } from "@/components/todo/TaskCard";

/**
 * Outer guard: returns null BEFORE any hooks run when there's no task
 * to render. This avoids a Rules-of-Hooks violation — calling a
 * different number of hooks between renders depending on whether
 * `task` is defined or not. All hooks live in TaskModalContent, which
 * is only ever mounted with a valid task.
 */
export default function TaskModal({ isOpen, task, ...rest }) {
  if (!isOpen || !task) return null;
  return <TaskModalContent isOpen={isOpen} task={task} {...rest} />;
}

/**
 * Full task editor — title, description, labels, assigned members,
 * due date, checklist, comments. All fields autosave on blur (or
 * on toggle for checkboxes / labels / member picks).
 */
function TaskModalContent({
  isOpen,
  onClose,
  task,
  boardId,
  members,
  profilesById,
}) {
  const { user } = useAuth();
  const toast = useToast();

  // Live form state. Re-seeded whenever a different task is opened.
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [savingField, setSavingField] = useState(null); // "title" | "description" | null

  useEffect(() => {
    setTitle(task?.title || "");
    setDescription(task?.description || "");
  }, [task?.id, task?.title, task?.description]);

  const save = async (updates, fieldKey) => {
    if (!boardId) return;
    setSavingField(fieldKey || null);
    try {
      await updateTask(boardId, task.id, updates);
    } catch (err) {
      console.error("updateTask failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte spara.");
    } finally {
      setSavingField(null);
    }
  };

  /* ── Title ───────────────────────────────────────────────────── */

  const titleDirty = title.trim() !== (task.title || "") && title.trim().length > 0;
  const commitTitle = async () => {
    if (!titleDirty) return;
    await save({ title: title.trim() }, "title");
  };

  /* ── Description ─────────────────────────────────────────────── */

  const descDirty = description.trim() !== (task.description || "").trim();
  const commitDescription = async () => {
    if (!descDirty) return;
    await save({ description: description.trim() }, "description");
  };

  /* ── Labels ──────────────────────────────────────────────────── */

  const labelIds = new Set(task.labels || []);
  const toggleLabel = (id) => {
    const next = new Set(labelIds);
    next.has(id) ? next.delete(id) : next.add(id);
    save({ labels: Array.from(next) });
  };

  /* ── Assigned members ────────────────────────────────────────── */

  const assigned = new Set(task.assignedUsers || []);
  const toggleAssignee = (uid) => {
    const next = new Set(assigned);
    next.has(uid) ? next.delete(uid) : next.add(uid);
    save({ assignedUsers: Array.from(next) });
  };

  /* ── Due date ────────────────────────────────────────────────── */

  const dueDateValue = useMemo(() => {
    if (!task.dueDate) return "";
    const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }, [task.dueDate]);

  const setDueDate = async (yyyymmdd) => {
    if (!yyyymmdd) {
      await save({ dueDate: null });
      return;
    }
    const [y, m, d] = yyyymmdd.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0); // noon, local
    await save({ dueDate: Timestamp.fromDate(date) });
  };

  const dueInfo = classifyDueDate(task.dueDate);

  /* ── Checklist ───────────────────────────────────────────────── */

  const checklist = task.checklist || [];
  const checklistDone = checklist.filter((c) => c.done).length;

  const addChecklistItem = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const item = {
      id: crypto.randomUUID(),
      text: trimmed,
      done: false,
    };
    await save({ checklist: [...checklist, item] });
  };

  const toggleChecklistItem = async (id) => {
    const next = checklist.map((c) =>
      c.id === id ? { ...c, done: !c.done } : c
    );
    await save({ checklist: next });
  };

  const updateChecklistText = async (id, text) => {
    const trimmed = (text || "").trim();
    const next = checklist.map((c) =>
      c.id === id ? { ...c, text: trimmed || c.text } : c
    );
    await save({ checklist: next });
  };

  const removeChecklistItem = async (id) => {
    await save({ checklist: checklist.filter((c) => c.id !== id) });
  };

  /* ── Delete ──────────────────────────────────────────────────── */

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTask(boardId, task.id);
      toast.success("Uppgiften har tagits bort.");
      onClose?.();
    } catch (err) {
      console.error("deleteTask failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte ta bort uppgiften.");
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Uppgift"
      subtitle="// task.edit()"
      size="lg"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-6">
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Title */}
          <div>
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.target.blur();
                }
              }}
              rows={1}
              maxLength={200}
              className="w-full resize-none text-lg font-heading text-slate-900 tracking-tight border-none px-0 py-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-slate-400 bg-transparent leading-tight"
              placeholder="Titel..."
            />
            {savingField === "title" && (
              <p className="text-[10px] text-slate-400 font-mono">sparar...</p>
            )}
          </div>

          {/* Labels on this task (mini-strip) */}
          {labelIds.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {LABEL_CATALOG.filter((l) => labelIds.has(l.id)).map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center px-2 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wider text-white"
                  style={{ backgroundColor: l.color }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <SectionLabel icon={MessageSquare} text="Beskrivning" />
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            placeholder="Lägg till en mer detaljerad beskrivning..."
            rows={4}
          />
          {savingField === "description" && (
            <p className="text-[10px] text-slate-400 font-mono">sparar...</p>
          )}

          {/* Checklist */}
          {checklist.length > 0 && (
            <>
              <SectionLabel
                icon={CheckSquare}
                text={`Checklist (${checklistDone}/${checklist.length})`}
              />
              {checklist.length > 0 && (
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-all duration-300"
                    style={{
                      width: `${(checklistDone / checklist.length) * 100}%`,
                    }}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                {checklist.map((c) => (
                  <ChecklistRow
                    key={c.id}
                    item={c}
                    onToggle={() => toggleChecklistItem(c.id)}
                    onTextChange={(text) => updateChecklistText(c.id, text)}
                    onDelete={() => removeChecklistItem(c.id)}
                  />
                ))}
              </div>
            </>
          )}
          <AddChecklistForm onAdd={addChecklistItem} />

          {/* Comments */}
          <SectionLabel icon={MessageSquare} text="Kommentarer" />
          <CommentsSection
            boardId={boardId}
            taskId={task.id}
            profilesById={profilesById}
          />
        </div>

        {/* ── Sidebar — properties ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Members */}
          <PropertyBox icon={Users} title="Tilldelade">
            {members.length === 0 ? (
              <p className="text-[10px] font-mono text-slate-400">
                Inga medlemmar i boarden.
              </p>
            ) : (
              <div className="space-y-1">
                {members.map((uid) => {
                  const p = profilesById?.get(uid);
                  if (!p) return null;
                  const picked = assigned.has(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      onClick={() => toggleAssignee(uid)}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition-colors",
                        picked
                          ? "bg-blue-50 hover:bg-blue-50/80"
                          : "hover:bg-slate-50"
                      )}
                    >
                      <Avatar
                        name={p.displayName}
                        src={p.photoURL}
                        size="xs"
                      />
                      <span className="text-xs font-body font-medium text-slate-900 truncate flex-1">
                        {p.displayName}
                      </span>
                      {picked && <Check className="w-3 h-3 text-[#0052FF] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </PropertyBox>

          {/* Labels picker */}
          <PropertyBox icon={Tag} title="Etiketter">
            <div className="space-y-1">
              {LABEL_CATALOG.map((l) => {
                const picked = labelIds.has(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    className={cn(
                      "w-full text-left px-2 py-2 rounded-lg flex items-start gap-2 transition-colors",
                      picked ? "ring-1 ring-inset" : "hover:bg-slate-50"
                    )}
                    style={
                      picked
                        ? {
                            backgroundColor: `${l.color}15`,
                            "--tw-ring-color": l.color,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="w-3 h-3 rounded shrink-0 mt-1"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-body font-semibold text-slate-800 leading-snug">
                        {l.name}
                      </span>
                      {l.description && (
                        <span className="block text-[10px] font-mono text-slate-500 mt-0.5 leading-snug">
                          {l.description}
                        </span>
                      )}
                    </span>
                    {picked && (
                      <Check className="w-3 h-3 text-slate-600 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </PropertyBox>

          {/* Due date */}
          <PropertyBox icon={CalendarDays} title="Förfallodatum">
            <input
              type="date"
              value={dueDateValue}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
            />
            {dueInfo && (
              <p
                className={cn(
                  "text-[10px] font-mono mt-1.5 px-2",
                  dueInfo.tone === "overdue"
                    ? "text-red-600"
                    : dueInfo.tone === "today"
                    ? "text-amber-600"
                    : "text-slate-500"
                )}
              >
                {dueInfo.label}
              </p>
            )}
          </PropertyBox>

          {/* Delete */}
          <div className="pt-2 border-t border-slate-100">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-mono leading-relaxed">
                  Säker på att du vill radera? Kan inte ångras.
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    loading={deleting}
                    onClick={handleDelete}
                    className="flex-1"
                  >
                    Radera
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Avbryt
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ta bort uppgift
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 font-mono px-2">
            Skapad {task.createdAt ? formatRelativeTime(task.createdAt) : "—"}
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function SectionLabel({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest">
      <Icon className="w-3 h-3" />
      <span>{text}</span>
    </div>
  );
}

function PropertyBox({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest px-1">
        <Icon className="w-3 h-3" />
        <span>{title}</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        {children}
      </div>
    </div>
  );
}

function ChecklistRow({ item, onToggle, onTextChange, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  useEffect(() => setText(item.text), [item.text]);

  const commit = () => {
    setEditing(false);
    if (text.trim() && text.trim() !== item.text) {
      onTextChange?.(text.trim());
    } else {
      setText(item.text);
    }
  };

  return (
    <div className="flex items-center gap-2 group">
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0"
        aria-label={item.done ? "Markera som ej klar" : "Markera som klar"}
      >
        {item.done ? (
          <CheckSquare className="w-4 h-4 text-emerald-500" />
        ) : (
          <Square className="w-4 h-4 text-slate-300" />
        )}
      </button>
      {editing ? (
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setText(item.text);
              setEditing(false);
            }
          }}
          className="flex-1 px-2 py-1 rounded-md bg-white border border-[#0052FF] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "flex-1 text-left text-sm font-body py-1",
            item.done
              ? "line-through text-slate-400"
              : "text-slate-700 hover:text-slate-900"
          )}
        >
          {item.text}
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
        aria-label="Ta bort"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddChecklistForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    await onAdd?.(trimmed);
    setText("");
    // Keep open for rapid entry.
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-500 hover:text-[#0052FF] hover:bg-blue-50 transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        Lägg till punkt
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setText("");
          }
        }}
        placeholder="Vad behöver göras?"
        className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-sm focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
      />
      <Button size="sm" type="submit" disabled={!text.trim()}>
        Lägg till
      </Button>
      <Button
        size="sm"
        variant="ghost"
        type="button"
        onClick={() => {
          setOpen(false);
          setText("");
        }}
      >
        Avbryt
      </Button>
    </form>
  );
}

function CommentsSection({ boardId, taskId, profilesById }) {
  const { user } = useAuth();
  const toast = useToast();
  const { comments, loading } = useTaskComments(boardId, taskId);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const taRef = useRef(null);

  const submit = async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting || !user) return;
    setSubmitting(true);
    try {
      await addComment(boardId, taskId, user.uid, trimmed);
      setText("");
      requestAnimationFrame(() => taRef.current?.focus());
    } catch (err) {
      console.error("addComment failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte spara kommentaren.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex items-end gap-2">
        <Avatar
          name={profilesById?.get(user?.uid)?.displayName}
          src={profilesById?.get(user?.uid)?.photoURL}
          size="sm"
          className="shrink-0 mb-1"
        />
        <div className="flex-1 flex items-end gap-2">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Skriv en kommentar..."
            disabled={submitting}
            className="flex-1 resize-none px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-body focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all max-h-32"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
              text.trim() && !submitting
                ? "bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white shadow-glow hover:brightness-110 active:scale-95"
                : "bg-slate-100 text-slate-300 cursor-not-allowed"
            )}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-[10px] font-mono text-slate-400 px-1">laddar...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs font-mono text-slate-400 px-1 italic">
          Inga kommentarer än — bli först!
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const p = profilesById?.get(c.userId);
            const mine = c.userId === user?.uid;
            return (
              <div key={c.id} className="flex items-start gap-2">
                <Avatar
                  name={p?.displayName}
                  src={p?.photoURL}
                  size="sm"
                  className="shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-xs font-body font-semibold text-slate-900">
                      {p?.displayName || (mine ? "Du" : "Okänd")}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {c.createdAt ? formatRelativeTime(c.createdAt) : ""}
                    </span>
                  </div>
                  <p className="text-sm font-body text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {c.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
