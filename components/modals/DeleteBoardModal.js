"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { AlertTriangle, KanbanSquare, Trash2 } from "lucide-react";
import { deleteBoardAndChildren } from "@/lib/todo";
import { useToast } from "@/contexts/ToastContext";

/**
 * Single-step confirmation before deleting an entire board.
 * On confirm: removes the board doc + every column, task and
 * comment under it (via deleteBoardAndChildren) and navigates
 * back to /todolist.
 */
export default function DeleteBoardModal({ isOpen, onClose, board }) {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleConfirm = async () => {
    if (!board) return;
    setSubmitting(true);
    try {
      await deleteBoardAndChildren(board.id);
      toast.success(`Boarden "${board.name}" har raderats.`);
      onClose?.();
      router.replace("/todolist");
    } catch (err) {
      console.error("deleteBoard failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte radera boarden.");
      setSubmitting(false);
    }
  };

  if (!board) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Radera board"
      subtitle="// board.delete()"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-slate-900">
              Är du säker på att du vill radera hela boarden?
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Alla kolumner, uppgifter och kommentarer raderas permanent.
              Detta kan inte ångras.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <KanbanSquare className="w-5 h-5 text-[#0052FF]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-semibold text-slate-900 truncate">
              {board.name}
            </p>
            {board.description && (
              <p className="text-xs text-slate-500 font-mono mt-1 truncate">
                {board.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            loading={submitting}
            onClick={handleConfirm}
          >
            Radera boarden
          </Button>
        </div>
      </div>
    </Modal>
  );
}
