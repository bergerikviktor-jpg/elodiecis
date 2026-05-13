"use client";

import { useMemo } from "react";
import {
  History,
  Pencil,
  Plus,
  Trash2,
  Archive,
  ArchiveRestore,
  UserPlus,
  Phone,
  Receipt,
  Wallet,
  FileText,
  Loader2,
} from "lucide-react";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";

import { useClientAuditLog } from "@/lib/useClientsData";
import { useUserProfiles } from "@/lib/useChatData";
import { AUDIT_ACTIONS } from "@/lib/schema";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";

const ACTION_META = {
  [AUDIT_ACTIONS.CREATE]: { label: "Skapad", icon: Plus, color: "#22c55e" },
  [AUDIT_ACTIONS.UPDATE]: { label: "Uppdaterad", icon: Pencil, color: "#0052FF" },
  [AUDIT_ACTIONS.ARCHIVE]: { label: "Arkiverad", icon: Archive, color: "#94a3b8" },
  [AUDIT_ACTIONS.RESTORE]: { label: "Återställd", icon: ArchiveRestore, color: "#22c55e" },
  [AUDIT_ACTIONS.DELETE]: { label: "Raderad", icon: Trash2, color: "#ef4444" },
  [AUDIT_ACTIONS.CONTACT_ADD]: { label: "Kontakt tillagd", icon: UserPlus, color: "#0052FF" },
  [AUDIT_ACTIONS.CONTACT_UPDATE]: { label: "Kontakt uppdaterad", icon: Pencil, color: "#0052FF" },
  [AUDIT_ACTIONS.CONTACT_DELETE]: { label: "Kontakt borttagen", icon: Trash2, color: "#ef4444" },
  [AUDIT_ACTIONS.ACTIVITY_ADD]: { label: "Aktivitet loggad", icon: Phone, color: "#a855f7" },
  [AUDIT_ACTIONS.ACTIVITY_DELETE]: { label: "Aktivitet borttagen", icon: Trash2, color: "#ef4444" },
  [AUDIT_ACTIONS.INVOICE_ADD]: { label: "Faktura skapad", icon: Receipt, color: "#f59e0b" },
  [AUDIT_ACTIONS.INVOICE_UPDATE]: { label: "Faktura uppdaterad", icon: Pencil, color: "#f59e0b" },
  [AUDIT_ACTIONS.INVOICE_PAYMENT]: { label: "Betalning registrerad", icon: Wallet, color: "#22c55e" },
  [AUDIT_ACTIONS.INVOICE_DELETE]: { label: "Faktura borttagen", icon: Trash2, color: "#ef4444" },
  [AUDIT_ACTIONS.FILE_ADD]: { label: "Fil uppladdad", icon: FileText, color: "#0052FF" },
  [AUDIT_ACTIONS.FILE_DELETE]: { label: "Fil borttagen", icon: Trash2, color: "#ef4444" },
};

/**
 * Read-only audit trail. Visar alla mutationer som lib/clients.js
 * loggar. Append-only på regelnivå.
 */
export default function AuditTab({ client, teamId }) {
  const { entries, loading } = useClientAuditLog(teamId, client.id);

  const authorUids = useMemo(
    () => Array.from(new Set(entries.map((e) => e.actorUid).filter(Boolean))),
    [entries]
  );
  const { profiles } = useUserProfiles(authorUids);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card padding="none" className="max-w-4xl">
        <EmptyState
          icon={History}
          title="Inga audit-poster än"
          description="När någon ändrar kunddata loggas det här automatiskt."
        />
      </Card>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-body font-bold text-slate-900 inline-flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          Audit log
          <span className="text-xs font-mono font-normal text-slate-400">
            {entries.length} {entries.length === 1 ? "post" : "poster"}
          </span>
        </h3>
        <p className="text-[10px] font-mono text-slate-400">
          Append-only · kan inte editeras
        </p>
      </div>

      <Card padding="none">
        <div className="divide-y divide-slate-100">
          {entries.map((entry) => {
            const meta = ACTION_META[entry.action] || {
              label: entry.action,
              icon: History,
              color: "#94a3b8",
            };
            const Icon = meta.icon;
            const author = profiles.get(entry.actorUid);

            return (
              <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${meta.color}15` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">
                    <span className="font-semibold">{meta.label}</span>
                    {entry.details && (
                      <DetailsSummary details={entry.details} action={entry.action} />
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-slate-400">
                    {author && (
                      <span className="inline-flex items-center gap-1">
                        <Avatar
                          name={author.displayName}
                          src={author.photoURL}
                          size="xs"
                        />
                        {author.displayName}
                      </span>
                    )}
                    {!author && <span>{entry.actorUid?.slice(0, 8) || "okänd"}</span>}
                    <span className="text-slate-300">·</span>
                    <span>{formatDate(entry.createdAt)}</span>
                    <span className="text-slate-300">·</span>
                    <span>{formatRelativeTime(entry.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/**
 * Liten sammanfattning av details-objektet beroende på action.
 * Vi visar inte hela diff:en — för stort. Bara nyckelfält + en
 * "+ N ändringar"-räknare.
 */
function DetailsSummary({ details, action }) {
  if (!details || typeof details !== "object") return null;

  if (action === AUDIT_ACTIONS.UPDATE && details.changes) {
    const keys = Object.keys(details.changes);
    if (keys.length === 0) return null;
    const shown = keys.slice(0, 3);
    return (
      <span className="text-slate-500 font-mono text-xs">
        {" — "}
        {shown.join(", ")}
        {keys.length > shown.length && ` +${keys.length - shown.length}`}
      </span>
    );
  }

  if (details.companyName) return <span className="text-slate-500 text-xs">{" — "}{details.companyName}</span>;
  if (details.name) return <span className="text-slate-500 text-xs">{" — "}{details.name}</span>;
  if (details.invoiceNumber) return <span className="text-slate-500 font-mono text-xs">{" — "}{details.invoiceNumber}</span>;
  if (details.title) return <span className="text-slate-500 text-xs">{" — "}{details.title}</span>;
  if (details.paidAmount) {
    return (
      <span className="text-slate-500 font-mono text-xs">
        {" — "}
        {details.paidAmount.toLocaleString("sv-SE")} kr
        {details.fullyPaid && " (fullt betalt)"}
      </span>
    );
  }
  return null;
}
