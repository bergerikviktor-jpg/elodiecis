"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/FormFields";

export default function NewFolderModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 100;

  const reset = () => {
    setName("");
    setError("");
    setSubmitting(false);
  };

  const close = () => {
    if (submitting) return; // can't close mid-save
    reset();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid || !user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, "users", user.uid, "folders"), {
        name: trimmed,
        createdAt: serverTimestamp(),
      });
      reset();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError("Kunde inte skapa mappen. Försök igen.");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Ny mapp" subtitle="// folder.create()">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Mappnamn"
          autoFocus
          placeholder="t.ex. Bilder, Klientavtal..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={submitting}
          required
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
