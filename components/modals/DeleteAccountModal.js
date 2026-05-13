"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/FormFields";
import { AlertTriangle } from "lucide-react";
import { deleteAccount, removeAllUserData } from "@/lib/account";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const CONFIRM_TEXT = "RADERA";

/**
 * Two-step destructive confirmation:
 *   1. Type "RADERA" to enable the form
 *   2. Provide the current password (Firebase requires recent auth)
 *
 * Mode controls whether we wipe-and-keep the account or wipe-and-delete:
 *   - "delete-all" → removes Firestore data only (account stays alive)
 *   - "delete-account" → removes Firestore data + Firebase Auth user
 */
export default function DeleteAccountModal({ isOpen, onClose, mode = "delete-account" }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const toast = useToast();

  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isDeleteAccount = mode === "delete-account";
  const confirmOk = confirmText.trim().toUpperCase() === CONFIRM_TEXT;
  const passwordOk = isDeleteAccount ? password.length > 0 : true;
  const valid = confirmOk && passwordOk;

  const reset = () => {
    setConfirmText("");
    setPassword("");
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
      if (isDeleteAccount) {
        await deleteAccount(password);
        // Auth deletion already signed the user out — go straight to /login.
        router.replace("/login");
      } else {
        await removeAllUserData(user.uid);
        toast.success("All data har tagits bort.");
        // After wiping, sign out to force a fresh bootstrap on next login.
        await signOut();
        router.replace("/login");
      }
    } catch (err) {
      console.error("delete failed", err?.code, err?.message);
      setError(err.message || "Kunde inte slutföra åtgärden.");
      setSubmitting(false);
    }
  };

  const title = isDeleteAccount ? "Radera konto" : "Ta bort all data";
  const subtitle = isDeleteAccount ? "// account.delete()" : "// data.purge()";
  const ctaLabel = isDeleteAccount ? "Radera kontot permanent" : "Ta bort all data";

  return (
    <Modal isOpen={isOpen} onClose={close} title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="w-10 h-10 rounded-xl bg-white border border-red-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-body font-semibold text-slate-900">
              {isDeleteAccount
                ? "Detta kan inte ångras."
                : "Du kommer att förlora all din data."}
            </p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {isDeleteAccount
                ? "Ditt konto, profil, alla mappar/filer/anteckningar, vänner och förfrågningar tas bort permanent från Firebase."
                : "Alla mappar, filer, anteckningar, vänner och förfrågningar tas bort. Ditt konto behålls men nollställs — du loggas ut efteråt."}
            </p>
          </div>
        </div>

        <Input
          label={
            <span>
              Skriv <span className="font-bold text-red-600">{CONFIRM_TEXT}</span> för att bekräfta
            </span>
          }
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_TEXT}
          autoFocus
          disabled={submitting}
          required
        />

        {isDeleteAccount && (
          <PasswordInput
            label="Bekräfta med ditt lösenord"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
          />
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button variant="danger" type="submit" loading={submitting} disabled={!valid}>
            {ctaLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
