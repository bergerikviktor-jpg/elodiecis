"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Receipt,
  Loader2,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useClientInvoices } from "@/lib/useClientsData";
import { deleteInvoice } from "@/lib/clients";
import { INVOICE_STATUSES } from "@/lib/schema";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

import NewInvoiceModal from "@/components/modals/NewInvoiceModal";
import RecordPaymentModal from "@/components/modals/RecordPaymentModal";

export default function InvoicesTab({ client, teamId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { invoices, loading } = useClientInvoices(teamId, client.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);

  // KPI-uträkningar baserat på den hämtade listan.
  const stats = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    let paidThisYear = 0;
    const now = Date.now();
    const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();

    for (const inv of invoices) {
      if (inv.status === "sent") {
        outstanding += inv.amountExVat || 0;
        const due = inv.dueDate?.toDate ? inv.dueDate.toDate().getTime() : null;
        if (due && due < now) overdue += 1;
      } else if (inv.status === "paid") {
        const paidAt = inv.paidAt?.toDate ? inv.paidAt.toDate().getTime() : null;
        if (paidAt && paidAt >= yearStart) {
          paidThisYear += inv.amountExVat || 0;
        }
      }
    }
    return { outstanding, overdue, paidThisYear };
  }, [invoices]);

  const handleDelete = async (inv) => {
    if (!user) return;
    if (!window.confirm(`Ta bort faktura ${inv.invoiceNumber}?`)) return;
    try {
      await deleteInvoice(teamId, client.id, inv.id, user.uid);
      toast.success("Faktura borttagen.");
    } catch (err) {
      console.error("deleteInvoice failed", err);
      toast.error(err.message || "Kunde inte ta bort.");
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* KPI-rad */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Utestående"
          value={formatCurrency(stats.outstanding, client.defaultCurrency)}
          tone={stats.outstanding > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Förfallna"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "danger" : "default"}
          suffix={stats.overdue === 1 ? "faktura" : "fakturor"}
        />
        <KpiCard
          label="Betalt i år"
          value={formatCurrency(stats.paidThisYear, client.defaultCurrency)}
        />
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-body font-bold text-slate-900">
          Fakturor
          <span className="ml-2 text-xs font-mono font-normal text-slate-400">
            {invoices.length} {invoices.length === 1 ? "rad" : "rader"}
          </span>
        </h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Ny faktura
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Receipt}
            title="Inga fakturor än"
            description="Reskontran är manuell — registrera de fakturor du skickat ut till kunden för att hålla koll på utestående."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Lägg till faktura
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  <th className="text-left px-5 py-3">Nr</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Datum</th>
                  <th className="text-left px-5 py-3">Förfallodag</th>
                  <th className="text-right px-5 py-3">Ex moms</th>
                  <th className="text-right px-5 py-3">Inkl moms</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    currency={client.defaultCurrency}
                    onEdit={() => setEditing(inv)}
                    onPay={() => setPaying(inv)}
                    onDelete={() => handleDelete(inv)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewInvoiceModal
        isOpen={createOpen || !!editing}
        editing={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        teamId={teamId}
        clientId={client.id}
        defaultCurrency={client.defaultCurrency}
        defaultPaymentTermDays={client.paymentTermDays}
      />

      <RecordPaymentModal
        isOpen={!!paying}
        invoice={paying}
        onClose={() => setPaying(null)}
        teamId={teamId}
        clientId={client.id}
        currency={client.defaultCurrency}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Rad-renderer
   ────────────────────────────────────────────────────────────────── */

function InvoiceRow({ invoice, currency, onEdit, onPay, onDelete }) {
  // "Förfallen" är derivat — status "sent" + dueDate i dåtid.
  const now = Date.now();
  const due = invoice.dueDate?.toDate ? invoice.dueDate.toDate().getTime() : null;
  const isOverdue = invoice.status === "sent" && due && due < now;

  const meta =
    INVOICE_STATUSES.find((s) => s.id === invoice.status) || INVOICE_STATUSES[0];

  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
      <td className="px-5 py-3 font-mono text-slate-900 whitespace-nowrap">
        {invoice.invoiceNumber}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-1.5">
          <Badge color={isOverdue ? "#ef4444" : meta.color} size="xs">
            {isOverdue ? "Förfallen" : meta.label}
          </Badge>
        </div>
      </td>
      <td className="px-5 py-3 font-mono text-slate-600 whitespace-nowrap">
        {formatDate(invoice.issueDate)}
      </td>
      <td className="px-5 py-3 font-mono text-slate-600 whitespace-nowrap">
        {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
      </td>
      <td className="px-5 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
        {formatCurrency(invoice.amountExVat || 0, invoice.currency || currency)}
      </td>
      <td className="px-5 py-3 text-right font-mono text-slate-900 font-semibold whitespace-nowrap">
        {formatCurrency(invoice.amountIncVat || 0, invoice.currency || currency)}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <button
              type="button"
              onClick={onPay}
              className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              title="Registrera betalning"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
            title="Redigera"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Ta bort"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function KpiCard({ label, value, suffix, tone = "default" }) {
  const toneClass = {
    default: "text-slate-900",
    warning: "text-amber-600",
    danger: "text-red-600",
  }[tone];
  return (
    <Card>
      <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={cn("text-2xl font-heading", toneClass)}>{value}</p>
      {suffix && (
        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{suffix}</p>
      )}
    </Card>
  );
}
