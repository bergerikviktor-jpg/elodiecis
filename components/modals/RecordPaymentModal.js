"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CalendarDays, Wallet } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { recordInvoicePayment } from "@/lib/clients";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Registrera betalning på en faktura.
 *
 * Standard: hela inkl-moms-beloppet på dagens datum (= full betalning).
 * Vid delbetalning lägger man in lägre belopp — fakturan stannar
 * kvar som "sent" tills paidAmount >= amountIncVat.
 */
export default function RecordPaymentModal({
  isOpen,
  onClose,
  teamId,
  clientId,
  invoice,
  currency = "SEK",
}) {
  const { user } = useAuth();
  const toast = useToast();

  const [paidAmount, setPaidAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !invoice) return;
    // Default = återstående belopp (inkl moms - redan betalt)
    const remaining = Math.max(
      0,
      (invoice.amountIncVat || 0) - (invoice.paidAmount || 0)
    );
    setPaidAmount(String(remaining));
    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    setPaidAt(
      `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    );
    setError("");
    setSubmitting(false);
  }, [isOpen, invoice]);

  if (!invoice) return null;

  const remaining = (invoice.amountIncVat || 0) - (invoice.paidAmount || 0);
  const amountNum = Number(paidAmount) || 0;
  const willBeFullyPaid = amountNum + (invoice.paidAmount || 0) >= (invoice.amountIncVat || 0);
  const canSubmit = !submitting && !!user && amountNum > 0 && amountNum <= remaining + 1;

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await recordInvoicePayment(teamId, clientId, invoice.id, user.uid, {
        paidAmount: amountNum,
        paidAt: paidAt ? new Date(paidAt + "T12:00:00") : new Date(),
      });
      toast.success(
        willBeFullyPaid ? "Faktura markerad som betald." : "Delbetalning registrerad."
      );
      onClose?.();
    } catch (err) {
      console.error("recordInvoicePayment failed", err);
      setError(err.message || "Kunde inte registrera betalningen.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Registrera betalning"
      subtitle={`// invoice.${invoice.invoiceNumber}.pay()`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Fakturasammanställning */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-2 text-xs font-mono">
          <Row label="Faktura" value={invoice.invoiceNumber} mono />
          <Row
            label="Totalt"
            value={formatCurrency(invoice.amountIncVat || 0, invoice.currency || currency)}
          />
          {(invoice.paidAmount || 0) > 0 && (
            <Row
              label="Tidigare betalt"
              value={formatCurrency(invoice.paidAmount || 0, invoice.currency || currency)}
            />
          )}
          <Row
            label="Återstår"
            value={formatCurrency(remaining, invoice.currency || currency)}
            tone="strong"
          />
        </div>

        <Input
          label={<FieldLabel icon={Wallet} text="Belopp att registrera (inkl moms)" />}
          type="number"
          min="0"
          step="1"
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          disabled={submitting}
          required
        />

        <Input
          label={<FieldLabel icon={CalendarDays} text="Betaldatum" />}
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
          disabled={submitting}
          required
        />

        {willBeFullyPaid && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs text-emerald-700 font-mono inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Fakturan markeras som betald.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            Registrera
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Row({ label, value, tone = "default", mono = false }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={
          tone === "strong"
            ? "text-slate-900 font-semibold"
            : mono
            ? "text-slate-700"
            : "text-slate-700"
        }
      >
        {value}
      </span>
    </div>
  );
}

function FieldLabel({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}
