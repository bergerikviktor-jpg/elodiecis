"use client";

import { useEffect, useRef, useState } from "react";
import {
  Wallet,
  FileText,
  Layers,
  Tag,
  CalendarDays,
  Receipt,
  Upload,
  X,
  Loader2,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { createExpense, uploadReceipt } from "@/lib/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/projects";
import { PROJECT_PHASES } from "@/lib/schema";
import { cn } from "@/lib/utils";

export default function AddExpenseModal({
  isOpen,
  onClose,
  teamId,
  projectId,
  defaultPhase = "pre_production",
}) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef(null);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState(defaultPhase);
  const [category, setCategory] = useState("other");
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDescription("");
      setAmount("");
      setPhase(defaultPhase);
      setCategory("other");
      setVendorName("");
      setInvoiceNumber("");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setReceiptFile(null);
      setUploadProgress(0);
      setError("");
      setSubmitting(false);
    }
  }, [isOpen, defaultPhase]);

  const amountNumber = amount === "" ? NaN : Number(amount.replace(/\s/g, ""));
  const validAmount = Number.isFinite(amountNumber) && amountNumber > 0;
  const valid = description.trim().length > 0 && validAmount;

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setError("Kvittot får max vara 10 MB.");
      return;
    }
    setError("");
    setReceiptFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid || !teamId || !projectId || !user) return;
    setSubmitting(true);
    try {
      let receipt = null;
      if (receiptFile) {
        receipt = await uploadReceipt(teamId, projectId, receiptFile, {
          onProgress: setUploadProgress,
        });
      }
      await createExpense(teamId, projectId, user.uid, {
        description,
        amount: amountNumber,
        phase,
        category,
        expenseDate,
        vendorName,
        invoiceNumber,
        receipt,
      });
      toast.success("Utgift sparad.");
      onClose?.();
    } catch (err) {
      console.error("createExpense failed", err?.code, err?.message);
      setError(err.message || "Kunde inte spara utgiften.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Ny utgift"
      subtitle="// expense.create() · ex moms"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={<FieldLabel icon={FileText} text="Beskrivning" />}
          autoFocus
          placeholder="t.ex. Kamerahyra Arri Alexa"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={240}
          disabled={submitting}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={<FieldLabel icon={Wallet} text="Belopp ex moms (SEK)" />}
            type="number"
            min="0"
            step="1"
            placeholder="45000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            required
          />
          <Input
            label={<FieldLabel icon={CalendarDays} text="Datum" />}
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={<FieldLabel icon={Layers} text="Fas" />}
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            options={PROJECT_PHASES.map((p) => ({
              value: p.id,
              label: p.label,
            }))}
            disabled={submitting}
          />
          <Select
            label={<FieldLabel icon={Tag} text="Kategori" />}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={EXPENSE_CATEGORIES.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
            disabled={submitting}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Leverantör (valfri)"
            placeholder="t.ex. Studio Norra"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            maxLength={120}
            disabled={submitting}
          />
          <Input
            label="Fakturanummer (valfri)"
            placeholder="t.ex. INV-2026-014"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            maxLength={60}
            disabled={submitting}
          />
        </div>

        {/* Receipt upload */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Receipt className="w-3 h-3" />
              Kvitto / faktura (valfri)
            </span>
          </label>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            onChange={handleFile}
            disabled={submitting}
          />
          {receiptFile ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                <Receipt className="w-4 h-4 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-body font-medium text-slate-900 truncate">
                  {receiptFile.name}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {(receiptFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptFile(null)}
                disabled={submitting}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 text-xs font-mono text-slate-500 hover:border-[#0052FF]/50 hover:text-[#0052FF] hover:bg-blue-50/50 transition-all duration-200 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Välj kvitto (bild eller PDF, max 10 MB)
            </button>
          )}

          {submitting && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Laddar upp... {uploadProgress}%
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button type="submit" loading={submitting} disabled={!valid}>
            Spara utgift
          </Button>
        </div>
      </form>
    </Modal>
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
