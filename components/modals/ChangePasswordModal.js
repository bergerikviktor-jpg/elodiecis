"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/FormFields";
import { Check, X, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { changeUserPassword } from "@/lib/account";
import { useToast } from "@/contexts/ToastContext";

// Same rules as signup — keep these in sync if they ever change there.
const PASSWORD_RULES = [
  { id: "length", label: "Minst 6 tecken", test: (pw) => pw.length >= 6 },
  { id: "upper", label: "Minst en stor bokstav (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { id: "lower", label: "Minst en liten bokstav (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { id: "digit", label: "Minst en siffra (0–9)", test: (pw) => /[0-9]/.test(pw) },
  { id: "special", label: "Minst ett specialtecken", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export default function ChangePasswordModal({ isOpen, onClose }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(next));
  const matches = next.length > 0 && next === confirm;
  const valid =
    current.length > 0 && passwordValid && matches && next !== current;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
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
    if (!valid) return;
    setSubmitting(true);
    try {
      await changeUserPassword(current, next);
      toast.success("Lösenordet har uppdaterats.");
      reset();
      onClose?.();
    } catch (err) {
      console.error("changeUserPassword failed", err?.code, err?.message);
      setError(err.message || "Kunde inte uppdatera lösenordet.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Byt lösenord"
      subtitle="// auth.updatePassword()"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
          <ShieldAlert className="w-4 h-4 text-[#0052FF] shrink-0 mt-0.5" />
          <p className="text-xs text-slate-700 leading-relaxed">
            Av säkerhetsskäl behöver du bekräfta ditt nuvarande lösenord innan
            du kan välja ett nytt.
          </p>
        </div>

        <PasswordInput
          label="Nuvarande lösenord"
          autoComplete="current-password"
          autoFocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          disabled={submitting}
          required
        />

        <PasswordInput
          label="Nytt lösenord"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          disabled={submitting}
          required
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
            Lösenordskrav
          </p>
          <ul className="space-y-1.5">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(next);
              return (
                <li
                  key={rule.id}
                  className="flex items-center gap-2 text-xs font-mono"
                >
                  {ok ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "transition-colors",
                      ok ? "text-emerald-600" : "text-slate-500"
                    )}
                  >
                    {rule.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <PasswordInput
          label="Bekräfta nytt lösenord"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={submitting}
          required
          error={
            confirm.length > 0 && !matches
              ? "Lösenorden matchar inte"
              : undefined
          }
        />

        {next.length > 0 && next === current && (
          <p className="text-xs text-amber-600 font-mono">
            Det nya lösenordet måste skilja sig från det nuvarande.
          </p>
        )}

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
            Byt lösenord
          </Button>
        </div>
      </form>
    </Modal>
  );
}
