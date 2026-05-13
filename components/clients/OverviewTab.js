"use client";

import { useMemo } from "react";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Tag,
  CalendarDays,
  Wallet,
  AlertCircle,
  Briefcase,
  FolderKanban,
  StickyNote,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";

import {
  useClientContacts,
  useClientInvoices,
  useClientDeals,
  useClientProjects,
} from "@/lib/useClientsData";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

/**
 * Översikt — en read-only sammanställning av kundens viktigaste fält.
 * Andra tabs gör det tunga jobbet — här är allt klick-genom.
 */
export default function OverviewTab({ client, teamId, manager }) {
  const { contacts } = useClientContacts(teamId, client.id);
  const { invoices } = useClientInvoices(teamId, client.id);
  const { deals } = useClientDeals(teamId, client.id);
  const { projects } = useClientProjects(teamId, client.id);

  const primaryContact = useMemo(
    () => contacts.find((c) => c.isPrimary) || contacts[0] || null,
    [contacts]
  );

  // Förfallna fakturor: status==="sent" och dueDate < idag
  const overdueCount = useMemo(() => {
    const now = Date.now();
    return invoices.filter((inv) => {
      if (inv.status !== "sent") return false;
      const due = inv.dueDate?.toDate ? inv.dueDate.toDate().getTime() : null;
      return due && due < now;
    }).length;
  }, [invoices]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl">
      {/* Vänster kolumn — bolagsinfo + kontakt + adress */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <SectionTitle icon={Building2} text="Bolagsinformation" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <Field label="Företagsnamn" value={client.companyName} />
            <Field label="Organisationsnummer" value={client.orgNumber} mono />
            <Field label="Kundnummer" value={client.clientNumber} mono />
            <Field label="Bransch" value={client.industry} />
            <Field label="VAT-nummer" value={client.vatNumber || "—"} mono />
            <Field
              label="Betalningsvillkor"
              value={`${client.paymentTermDays || 30} dagar`}
            />
            <Field
              label="Standardvaluta"
              value={client.defaultCurrency || "SEK"}
              mono
            />
            <Field
              label="Skapad"
              value={formatDate(client.createdAt)}
              mono
            />
          </div>

          {Array.isArray(client.tags) && client.tags.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-2">
                <Tag className="w-3 h-3 inline mr-1" />
                Taggar
              </p>
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((t) => (
                  <Badge key={t} color="#0052FF" size="xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {client.notes && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-2">
                <StickyNote className="w-3 h-3 inline mr-1" />
                Intern anteckning
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {client.notes}
              </p>
            </div>
          )}
        </Card>

        {/* Adresser */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card>
            <SectionTitle icon={MapPin} text="Fakturaadress" />
            <AddressBlock value={client.billing} />
          </Card>
          <Card>
            <SectionTitle icon={MapPin} text="Besöksadress" />
            <AddressBlock value={client.visit} />
          </Card>
        </div>
      </div>

      {/* Höger kolumn — KPI + ansvarig + primärkontakt */}
      <div className="space-y-6">
        <Card>
          <SectionTitle icon={Wallet} text="Ekonomi" />
          <div className="space-y-3">
            <KpiRow
              label="Utestående"
              value={formatCurrency(client.outstandingBalance || 0, client.defaultCurrency)}
              tone={(client.outstandingBalance || 0) > 0 ? "warning" : "default"}
            />
            <KpiRow
              label="Total omsättning"
              value={formatCurrency(client.totalRevenue || 0, client.defaultCurrency)}
            />
            {overdueCount > 0 && (
              <KpiRow
                label="Förfallna fakturor"
                value={overdueCount}
                tone="danger"
                icon={AlertCircle}
              />
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Briefcase} text="Aktiv pipeline" />
          <div className="space-y-3">
            <KpiRow
              label="Affärer"
              value={deals.length}
              icon={Briefcase}
            />
            <KpiRow
              label="Projekt"
              value={projects.length}
              icon={FolderKanban}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle icon={Building2} text="Kundansvarig" />
          {manager ? (
            <div className="flex items-center gap-3">
              <Avatar name={manager.displayName} src={manager.photoURL} size="md" />
              <div className="min-w-0">
                <p className="text-sm font-body font-semibold text-slate-900 truncate">
                  {manager.displayName}
                </p>
                {manager.email && (
                  <p className="text-xs text-slate-500 font-mono truncate">
                    {manager.email}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-mono">Ingen tilldelad.</p>
          )}
        </Card>

        <Card>
          <SectionTitle icon={Phone} text="Primärkontakt" />
          {primaryContact ? (
            <div className="space-y-2">
              <p className="text-sm font-body font-semibold text-slate-900">
                {[primaryContact.firstName, primaryContact.lastName].filter(Boolean).join(" ") || "—"}
              </p>
              {primaryContact.title && (
                <p className="text-xs text-slate-500">{primaryContact.title}</p>
              )}
              {primaryContact.email && (
                <p className="text-xs text-slate-600 font-mono inline-flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  <a href={`mailto:${primaryContact.email}`} className="hover:text-[#0052FF]">
                    {primaryContact.email}
                  </a>
                </p>
              )}
              {primaryContact.phone && (
                <p className="text-xs text-slate-600 font-mono inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <a href={`tel:${primaryContact.phone}`} className="hover:text-[#0052FF]">
                    {primaryContact.phone}
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-mono">
              Inga kontaktpersoner än — lägg till i fliken Kontakter.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Subkomponenter
   ────────────────────────────────────────────────────────────────── */

function SectionTitle({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-slate-500" />
      <h3 className="text-sm font-body font-bold text-slate-900 tracking-tight">
        {text}
      </h3>
    </div>
  );
}

function Field({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-sm text-slate-900 truncate",
          mono && "font-mono",
          !value && "text-slate-400"
        )}
      >
        {value || "—"}
      </p>
    </div>
  );
}

function AddressBlock({ value }) {
  if (!value || (!value.address && !value.postalCode && !value.city)) {
    return <p className="text-xs text-slate-400 font-mono">Inte angiven</p>;
  }
  return (
    <div className="text-sm text-slate-700 space-y-0.5">
      {value.address && <p>{value.address}</p>}
      {(value.postalCode || value.city) && (
        <p>
          {value.postalCode} {value.city}
        </p>
      )}
      {value.country && value.country !== "SE" && (
        <p className="text-xs text-slate-500 font-mono">{value.country}</p>
      )}
    </div>
  );
}

function KpiRow({ label, value, tone = "default", icon: Icon }) {
  const toneClass = {
    default: "text-slate-900",
    warning: "text-amber-600",
    danger: "text-red-600",
  }[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-mono text-slate-500 inline-flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      <span className={cn("text-sm font-mono font-semibold", toneClass)}>
        {value}
      </span>
    </div>
  );
}
