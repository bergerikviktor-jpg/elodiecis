"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/FormFields";

export default function NewTeamMemberModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const valid = trimmedName.length > 0 && trimmedName.length <= 100;

  const reset = () => {
    setName("");
    setRole("");
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
        name: trimmedName,
        createdAt: serverTimestamp(),
      };
      const trimmedRole = role.trim();
      if (trimmedRole) payload.role = trimmedRole;

      await addDoc(collection(db, "users", user.uid, "teamMembers"), payload);
      reset();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError("Kunde inte lägga till kollegan. Försök igen.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Lägg till kollega"
      subtitle="// team.add()"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Namn"
          autoFocus
          placeholder="t.ex. Anna Svensson"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={submitting}
          required
        />
        <Input
          label="Roll (valfri)"
          placeholder="t.ex. Producer, Klippare..."
          value={role}
          onChange={(e) => setRole(e.target.value)}
          maxLength={100}
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
            Lägg till
          </Button>
        </div>
      </form>
    </Modal>
  );
}
