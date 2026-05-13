"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { AlertTriangle } from "lucide-react";
import { removeFriend } from "@/lib/friends";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export default function RemoveFriendModal({ isOpen, onClose, friend }) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleConfirm = async () => {
    if (!user || !friend) return;
    setSubmitting(true);
    try {
      await removeFriend(user.uid, friend.id);
      toast.success(`${friend.displayName || "Vännen"} har tagits bort.`);
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Kunde inte ta bort vännen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!friend) return null;

  return (
    <Modal isOpen={isOpen} onClose={close} title="Ta bort vän" subtitle="// friendship.delete()">
      <div className="space-y-5">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-slate-900">
              Är du säker på att du vill ta bort vänskapen?
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Den här åtgärden kan inte ångras. Ni kan alltid lägga till varandra igen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <Avatar name={friend.displayName} src={friend.photoURL} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-semibold text-slate-900 truncate">
              {friend.displayName}
            </p>
            <p className="text-xs text-slate-500 font-mono truncate">
              {friend.email}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button variant="danger" loading={submitting} onClick={handleConfirm}>
            Ta bort vän
          </Button>
        </div>
      </div>
    </Modal>
  );
}
