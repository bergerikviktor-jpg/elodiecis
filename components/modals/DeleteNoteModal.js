"use client";

import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { AlertTriangle, StickyNote } from "lucide-react";
import { truncate } from "@/lib/utils";

/**
 * Confirmation modal before deleting a note. Matches the visual
 * pattern of RemoveFriendModal: red-tinted warning panel + preview
 * of what's being deleted + danger CTA.
 */
export default function DeleteNoteModal({ isOpen, onClose, note }) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleConfirm = async () => {
    if (!user || !note) return;
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, "users", user.uid, "notes", note.id));
      toast.success("Anteckningen har tagits bort.");
      onClose?.();
    } catch (err) {
      console.error("deleteNote failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte ta bort anteckningen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!note) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Ta bort anteckning"
      subtitle="// note.delete()"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-slate-900">
              Är du säker på att du vill ta bort anteckningen?
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Den här åtgärden kan inte ångras.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <StickyNote className="w-5 h-5 text-amber-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-semibold text-slate-900 truncate">
              {note.title}
            </p>
            {note.content && (
              <p className="text-xs text-slate-500 font-mono mt-1 leading-relaxed line-clamp-2">
                {truncate(note.content, 140)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button variant="danger" loading={submitting} onClick={handleConfirm}>
            Ta bort anteckning
          </Button>
        </div>
      </div>
    </Modal>
  );
}
