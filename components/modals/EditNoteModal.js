"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/FormFields";

/**
 * Edit-in-place modal for an existing note. Same shape as NewNoteModal
 * but writes via updateDoc on the note's document. Saves only the
 * fields the user actually changed (no clobbering of unrelated data
 * like createdAt).
 */
export default function EditNoteModal({ isOpen, onClose, note }) {
  const { user } = useAuth();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Re-prime the form whenever the target note changes (e.g. user
  // closed without saving and reopened a different note).
  useEffect(() => {
    if (!isOpen) return;
    setTitle(note?.title || "");
    setContent(note?.content || "");
    setError("");
    setSubmitting(false);
  }, [isOpen, note]);

  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();
  const valid = trimmedTitle.length > 0 && trimmedTitle.length <= 150;

  // Dirty check — only enable Save if something actually changed.
  const dirty =
    trimmedTitle !== (note?.title || "") ||
    trimmedContent !== (note?.content || "");

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid || !dirty || !user || !note) return;
    setSubmitting(true);
    try {
      const updates = {
        title: trimmedTitle,
        updatedAt: serverTimestamp(),
      };
      // If the user emptied the content field on an existing note, remove
      // the field instead of writing an empty string — keeps the doc shape
      // consistent with NewNoteModal (which only sets `content` when present).
      if (trimmedContent) {
        updates.content = trimmedContent;
      } else if (note.content) {
        updates.content = deleteField();
      }

      await updateDoc(
        doc(db, "users", user.uid, "notes", note.id),
        updates
      );
      toast.success("Anteckningen har uppdaterats.");
      onClose?.();
    } catch (err) {
      console.error("updateNote failed", err?.code, err?.message);
      setError(err.message || "Kunde inte spara anteckningen.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Redigera anteckning"
      subtitle="// note.update()"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Titel"
          autoFocus
          placeholder="t.ex. Mötesanteckningar..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          disabled={submitting}
          required
        />
        <Textarea
          label="Innehåll (valfritt)"
          placeholder="Skriv din anteckning här..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          disabled={submitting}
        />
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button type="submit" loading={submitting} disabled={!valid || !dirty}>
            Spara ändringar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
