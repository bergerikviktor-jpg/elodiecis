"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/FormFields";

/**
 * Metadata-only file modal — no actual upload happens. Saves
 * `users/{uid}/files/{fileId}` with name, size, optional folderId.
 */
export default function UploadFileModal({ isOpen, onClose, folders = [] }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [folderId, setFolderId] = useState("");
  const [size, setSize] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = name.trim();
  const sizeNumber = Number(size);
  const validName = trimmedName.length > 0 && trimmedName.length <= 200;
  const validSize = size !== "" && Number.isFinite(sizeNumber) && sizeNumber >= 0;
  const valid = validName && validSize;

  const reset = () => {
    setName("");
    setFolderId("");
    setSize("");
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
        size: Math.floor(sizeNumber),
        createdAt: serverTimestamp(),
      };
      if (folderId) payload.folderId = folderId;

      await addDoc(collection(db, "users", user.uid, "files"), payload);
      reset();
      onClose?.();
    } catch (err) {
      console.error(err);
      setError("Kunde inte spara filen. Försök igen.");
      setSubmitting(false);
    }
  };

  // Folders → Select options. Empty value = no folder.
  const folderOptions = [
    { value: "", label: "— Ingen mapp —" },
    ...folders.map((f) => ({ value: f.id, label: f.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Ladda upp fil"
      subtitle="// file.create() · endast metadata"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Filnamn"
          autoFocus
          placeholder="dokument.pdf"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          disabled={submitting}
          required
        />
        <Select
          label="Mapp (valfri)"
          options={folderOptions}
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          disabled={submitting}
        />
        <Input
          label="Filstorlek (byte)"
          type="number"
          min="0"
          step="1"
          placeholder="t.ex. 2048000"
          value={size}
          onChange={(e) => setSize(e.target.value)}
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
            Spara
          </Button>
        </div>
      </form>
    </Modal>
  );
}
