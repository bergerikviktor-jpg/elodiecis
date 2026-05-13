"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Hash,
  CalendarDays,
  Wallet,
  Percent,
  FileText,
  Tag,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { addInvoice, updateInvoice } from "@/lib/clients";
import { INVOICE_STATUSES, CURRENCIES } from "@/lib/schema";
import { formatCurrency } from "@/lib/utils";

/**
 * Skapa eller redigera en faktura (manuell reskontra).
 *
 * Beloppen lagras ex moms; moms räknas ut av addInvoice/updateInvoice
 * baserat på `vatRate` (default 25 för SEK). UI:t förhandsvisar
 * beräkningarna direkt — vad du ser är vad som sparas.
 */
export default function NewInvoiceModal({
  isOpen,
  onClose,
  teamId,
  clientId,
  editing,
  defaultCurrency = "SEK",
  defaultPaymentTermDays = 30,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const isEdit = !!editing;

  const todayStr = () => toDateInputValue(new Date());

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState("");
  const [amountExVat, setAmountExVat] = useState("");
  const [vatRate, setVatRate] = useState("25");
  const [status, setStatus] = useState("draft");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSubmitting(false);
    if (editing) {
      setInvoiceNumber(editing.invoiceNumber || "");
      setIssueDate(toDateInputValue(editing.issueDate?.toDate?.() || editing.issueDate));
      setDueDate(
        editing.dueDate
          ? toDateInputValue(editing.dueDate?.toDate?.() || editing.dueDate)
          : ""
      );
      setAmountExVat(String(editing.amountExVat ?? ""));
      setVatRate(String(editing.vatRate ?? 25));
      setStatus(editing.status || "draft");
      setDescription(editing.description || "");
      setReference(editing.reference || "");
      setCurrency(editing.currency || defaultCurrency);
    } else {
      setInvoiceNumber("");
      const issue = new Date();
      setIssueDate(toDateInputValue(issue));
      // Default förfallodag = idag + paymentTermDays
      const due = new Date(issue);
      due.setDate(due.getDate() + (defaultPaymentTermDays || 30));
      setDueDate(toDateInputValue(due));
      setAmountExVat("");
      setVatRate("25");
      setStatus("draft");
      setDescription("");
      setReference("");
      setCurrency(defaultCurrency);
    }
  }, [isOpen, editing, defaultCurrency, defaultPaymentTermDays]);

  // Live-totals för preview
  const totals = useMemo(() => {
    const ex = Math.max(0, Math.round(Number(amountExVat) || 0));
    const rate = Math.max(0, Number(vatRate) || 0);
    const vat = Math.round(ex * (rate / 100));
    return { ex, rate, vat, inc: ex + vat };
  }, [amountExVat, vatRate]);

  const canSubmit =
    !submitting &&
    !!teamId &&
    !!clientId &&
    !!user &&
    invoiceNumber.trim().length > 0 &&
    totals.ex > 0;

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
      const payload = {
        invoiceNumber: invoiceNumber.trim(),
        issueDate: new Date(issueDate + "T12:00:00"),
        dueDate: dueDate ? new Date(dueDate + "T12:00:00") : null,
        amountExVat: totals.ex,
        vatRate: totals.rate,
        currency,
        status,
        description: description.trim(),
        reference: reference.trim(),
      };
      if (isEdit) {
        await updateInvoice(teamId, clientId, editing.id, user.uid, payload);
        toast.success("Faktura uppdaterad.");
      } else {
        await addInvoice(teamId, clientId, user.uid, payload);
        toast.success("Faktura skapad.");
      }
      onClose?.();
    } catch (err) {
      console.error("addInvoice/updateInvoice failed", err);
      setError(err.message || "Kunde inte spara fakturan.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={isEdit ? "Redigera faktura" : "Ny faktura"}
      subtitle={isEdit ? "// invoice.update()" : "// invoice.add()"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label={<FieldLabel icon={Hash} text="Fakturanr" />}
            placeholder="2026-001"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            maxLength={50}
            disabled={submitting}
            autoFocus
            required
            className="sm:col-span-2"
          />
          <Select
            label={<FieldLabel icon={Tag} text="Status" />}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={INVOICE_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={<FieldLabel icon={CalendarDays} text="Fakturadatum" />}
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            disabled={submitting}
            required
          />
          <Input
            label={<FieldLabel icon={CalendarDays} text="Förfallodag" />}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label={<FieldLabel icon={Wallet} text="Belopp ex moms" />}
            type="number"
            min="0"
            step="1"
            placeholder="10000"
            value={amountExVat}
            onChange={(e) => setAmountExVat(e.target.value)}
            disabled={submitting}
            required
            className="sm:col-span-2"
          />
          <Input
            label={<FieldLabel icon={Percent} text="Moms %" />}
            type="number"
            min="0"
            max="100"
            step="0.5"
            placeholder="25"
            value={vatRate}
            onChange={(e) => setVatRate(e.target.value)}
            disabled={submitting}
          />
        </div>

        {/* Beräkning-preview */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 grid grid-cols-3 gap-4 text-xs font-mono">
          <PreviewCol label="Ex moms" value={formatCurrency(totals.ex, currency)} />
          <PreviewCol label={`Moms (${totals.rate}%)`} value={formatCurrency(totals.vat, currency)} />
          <PreviewCol label="Inkl moms" value={formatCurrency(totals.inc, currency)} tone="strong" />
        </div>

        <Select
          label="Valuta"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c.id, label: c.label }))}
          disabled={submitting}
        />

        <Textarea
          label={<FieldLabel icon={FileText} text="Beskrivning" />}
          placeholder="Vad fakturan avser..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          disabled={submitting}
        />

        <Input
          label="Referens / PO-nummer"
          placeholder="Valfri intern referens"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          maxLength={100}
          disabled={submitting}
        />

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
            {isEdit ? "Spara" : "Skapa faktura"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function toDateInputValue(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function FieldLabel({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}

function PreviewCol({ label, value, tone = "default" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-400">{label}</p>
      <p
        className={
          tone === "strong"
            ? "text-sm font-semibold text-slate-900 mt-1"
            : "text-sm text-slate-700 mt-1"
        }
      >
        {value}
      </p>
    </div>
  );
}
