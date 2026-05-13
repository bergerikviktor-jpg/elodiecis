"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import NewNoteModal from "@/components/modals/NewNoteModal";
import EditNoteModal from "@/components/modals/EditNoteModal";
import DeleteNoteModal from "@/components/modals/DeleteNoteModal";
import { useUserCollection } from "@/lib/useUserCollection";
import { formatRelativeTime } from "@/lib/utils";
import { Plus, StickyNote, Pencil, Trash2 } from "lucide-react";

export default function NotesPage() {
  const { items: notes, loading } = useUserCollection("notes");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  return (
    <>
      <Header
        title="Mina anteckningar"
        subtitle={
          loading
            ? "// laddar..."
            : `// ${notes.length} ${notes.length === 1 ? "anteckning" : "anteckningar"}`
        }
        actions={
          <Button icon={Plus} size="md" onClick={() => setCreateOpen(true)}>
            Ny anteckning
          </Button>
        }
      />

      <div className="p-8 animate-fade-in">
        {loading ? (
          <LoadingState />
        ) : notes.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={StickyNote}
              title="Inga anteckningar än"
              description="Skapa din första anteckning för att komma igång."
              action={
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  Ny anteckning
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => setEditTarget(note)}
                onDelete={() => setDeleteTarget(note)}
              />
            ))}
          </div>
        )}
      </div>

      <NewNoteModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditNoteModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        note={editTarget}
      />
      <DeleteNoteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        note={deleteTarget}
      />
    </>
  );
}

function NoteCard({ note, onEdit, onDelete }) {
  return (
    <Card hover className="group flex flex-col relative">
      {/* Action icons — top-right, subtle by default, color on hover.
          We use absolute positioning so they don't disturb the card's
          existing layout. */}
      <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all duration-200"
          aria-label="Redigera anteckning"
          title="Redigera"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
          aria-label="Ta bort anteckning"
          title="Ta bort"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Header — leave room on the right for the icon strip. */}
      <div className="flex items-start gap-3 mb-3 pr-16">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center transition-all duration-300 group-hover:scale-110 shrink-0">
          <StickyNote className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-base font-body font-semibold text-slate-900 group-hover:text-[#0052FF] transition-colors tracking-tight leading-snug">
          {note.title}
        </h3>
      </div>

      {note.content && (
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-5 mb-4">
          {note.content}
        </p>
      )}

      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
          {formatRelativeTime(note.createdAt)}
        </span>
        {note.updatedAt && note.updatedAt !== note.createdAt && (
          <span className="text-[10px] text-slate-400 font-mono italic">
            redigerad
          </span>
        )}
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <div className="space-y-3 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-200" />
              <div className="flex-1 h-4 rounded bg-slate-200 mt-1" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-5/6 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
