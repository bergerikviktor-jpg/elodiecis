"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/FormFields";

export default function NewNoteModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedTitle = title.trim();
  const valid = trimmedTitle.length > 0 && trimmedTitle.length <= 150;

  const reset = () => {
    setTitle("");
    setContent("");
    setError("");
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid || !user) return;
    setSubmitting(true);
    try {
      const payload = {
        title: trimmedTitle,
        createdAt: serverTimestamp(),
      };
      const trimmedContent = content.trim();
      if (trimmedContent) payload.content = trimmedContent;

      await addDoc(collection(db, "users", user.uid, "notes"), payload);
      reset();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError("Kunde inte spara anteckningen. Försök igen.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Ny anteckning"
      subtitle="// note.create()"
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
          rows={6}
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
          <Button type="submit" loading={submitting} disabled={!valid}>
            Skapa
          </Button>
        </div>
      </form>
    </Modal>
  );
}
