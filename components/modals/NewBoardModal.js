"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { createBoard, BOARD_BACKGROUNDS } from "@/lib/todo";
import { cn } from "@/lib/utils";

export default function NewBoardModal({ isOpen, onClose }) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [background, setBackground] = useState(BOARD_BACKGROUNDS[0].id);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 100;

  const reset = () => {
    setName("");
    setDescription("");
    setBackground(BOARD_BACKGROUNDS[0].id);
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
      const boardId = await createBoard(user.uid, {
        name: trimmed,
        description,
        background,
      });
      toast.success(`Boarden "${trimmed}" skapades.`);
      reset();
      onClose?.();
      router.push(`/todolist/${boardId}`);
    } catch (err) {
      console.error("createBoard failed", err?.code, err?.message);
      setError(err.message || "Kunde inte skapa boarden.");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Ny board" subtitle="// board.create()">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Boardnamn"
          autoFocus
          placeholder="t.ex. Webbdesign-projektet"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={submitting}
          required
        />
        <Textarea
          label="Beskrivning (valfri)"
          placeholder="Vad handlar boarden om?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          disabled={submitting}
        />

        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
            Bakgrund
          </label>
          <div className="grid grid-cols-5 gap-2">
            {BOARD_BACKGROUNDS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackground(bg.id)}
                disabled={submitting}
                className={cn(
                  "aspect-square rounded-xl border-2 transition-all duration-200",
                  background === bg.id
                    ? "border-[#0052FF] scale-105 shadow-glow"
                    : "border-transparent hover:scale-105"
                )}
                style={{ background: bg.value }}
                aria-label={`Bakgrund ${bg.id}`}
              />
            ))}
          </div>
        </div>

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
            Skapa board
          </Button>
        </div>
      </form>
    </Modal>
  );
}
