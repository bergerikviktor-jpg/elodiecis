"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  LayoutDashboard,
  Users,
  Activity,
  Receipt,
  Briefcase,
  FolderOpen,
  History,
  MoreHorizontal,
  Pencil,
  Archive,
  ArchiveRestore,
  Download,
  Trash2,
  Loader2,
  Hash,
  Building2,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useTeam } from "@/lib/useTeamsData";
import { useClient } from "@/lib/useClientsData";
import { useUserProfiles } from "@/lib/useChatData";
import {
  archiveClient,
  restoreClient,
  hardDeleteClient,
  exportClientData,
} from "@/lib/clients";
import { cn } from "@/lib/utils";

import OverviewTab from "@/components/clients/OverviewTab";
import ContactsTab from "@/components/clients/ContactsTab";
import ActivityTab from "@/components/clients/ActivityTab";
import InvoicesTab from "@/components/clients/InvoicesTab";
import ProjectsTab from "@/components/clients/ProjectsTab";
import FilesTab from "@/components/clients/FilesTab";
import AuditTab from "@/components/clients/AuditTab";
import EditClientModal from "@/components/modals/EditClientModal";

const TABS = [
  { id: "overview", label: "Översikt", icon: LayoutDashboard },
  { id: "contacts", label: "Kontakter", icon: Users },
  { id: "activity", label: "Aktivitet", icon: Activity },
  { id: "invoices", label: "Reskontra", icon: Receipt },
  { id: "projects", label: "Affärer & Projekt", icon: Briefcase },
  { id: "files", label: "Filer", icon: FolderOpen },
  { id: "audit", label: "Audit", icon: History },
];

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const clientId = params?.clientId;
  const teamId = searchParams?.get("team");

  const { user } = useAuth();
  const toast = useToast();
  const { team, loading: teamLoading } = useTeam(teamId);
  const { client, loading: clientLoading, notFound } = useClient(teamId, clientId);

  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);

  // Hämta profil för kundansvarig — används av flera tabs
  const managerUids = useMemo(
    () => (client?.accountManagerUid ? [client.accountManagerUid] : []),
    [client?.accountManagerUid]
  );
  const { profiles: managerProfiles } = useUserProfiles(managerUids);
  const manager = client?.accountManagerUid
    ? managerProfiles.get(client.accountManagerUid)
    : null;

  /* ── Render-guards ─────────────────────────────────────────────── */

  if (!teamId) {
    return (
      <>
        <Header title="Kund" subtitle="// ?" />
        <div className="p-8">
          <Card>
            <p className="text-sm text-slate-600">
              Saknar team-parameter i URL:en.{" "}
              <Link href="/clients" className="text-[#0052FF] underline">
                Tillbaka till kunder
              </Link>
              .
            </p>
          </Card>
        </div>
      </>
    );
  }

  if (teamLoading || clientLoading) {
    return (
      <>
        <Header title="Kund" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  if (notFound || !client) {
    return (
      <>
        <Header title="Kund" subtitle="// inte hittad" />
        <div className="p-8">
          <Card>
            <p className="text-sm text-slate-600">
              Den här kunden finns inte (eller har raderats).{" "}
              <Link href="/clients" className="text-[#0052FF] underline">
                Tillbaka till listan
              </Link>
              .
            </p>
          </Card>
        </div>
      </>
    );
  }

  const isArchived = client.status === "archived";

  /* ── Action handlers ──────────────────────────────────────────── */

  const onArchive = async () => {
    if (!user) return;
    try {
      await archiveClient(teamId, clientId, user.uid);
      toast.success(`${client.companyName} arkiverad.`);
    } catch (err) {
      console.error("archiveClient failed", err);
      toast.error(err.message || "Kunde inte arkivera.");
    }
  };

  const onRestore = async () => {
    if (!user) return;
    try {
      await restoreClient(teamId, clientId, user.uid);
      toast.success(`${client.companyName} återställd.`);
    } catch (err) {
      console.error("restoreClient failed", err);
      toast.error(err.message || "Kunde inte återställa.");
    }
  };

  const onExport = async () => {
    try {
      const data = await exportClientData(teamId, clientId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(client.clientNumber || clientId)}-${slugify(client.companyName)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export skapad.");
    } catch (err) {
      console.error("exportClientData failed", err);
      toast.error(err.message || "Kunde inte exportera.");
    }
  };

  const onHardDelete = async () => {
    if (!user) return;
    const ok = window.confirm(
      `Radera ${client.companyName} permanent? Detta går inte att ångra.\n\n` +
        "OBS: Kunden måste vara arkiverad och inte ha kvar några kontakter, aktivitetsloggar, fakturor, filer, affärer eller projekt."
    );
    if (!ok) return;
    try {
      await hardDeleteClient(teamId, clientId, user.uid);
      toast.success("Kunden raderad permanent.");
      router.push("/clients");
    } catch (err) {
      console.error("hardDeleteClient failed", err);
      toast.error(err.message || "Kunde inte radera.");
    }
  };

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <>
      <Header
        title={
          <span className="inline-flex items-center gap-2">
            <Link
              href="/clients"
              className="p-1.5 -ml-1.5 rounded-md text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
              title="Tillbaka till kunder"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <span className="truncate">{client.companyName}</span>
            {isArchived && (
              <Badge color="#94a3b8" size="xs">
                Arkiverad
              </Badge>
            )}
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-2 text-xs font-mono">
            <Hash className="w-3 h-3" />
            {client.clientNumber || "—"}
            <span className="text-slate-300">·</span>
            <span>{client.orgNumber || "—"}</span>
            {client.industry && (
              <>
                <span className="text-slate-300">·</span>
                <span>{client.industry}</span>
              </>
            )}
          </span>
        }
        actions={
          <ClientActionsMenu
            isArchived={isArchived}
            onEdit={() => setEditOpen(true)}
            onArchive={onArchive}
            onRestore={onRestore}
            onExport={onExport}
            onHardDelete={onHardDelete}
          />
        }
      />

      {/* Tab-bar */}
      <div className="px-8 pt-4 border-b border-slate-200 sticky top-0 z-10 bg-slate-50/80 backdrop-blur">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-3 text-sm font-body transition-all duration-200 border-b-2 -mb-px",
                  active
                    ? "border-[#0052FF] text-[#0052FF]"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="p-8 animate-fade-in">
        {activeTab === "overview" && (
          <OverviewTab
            client={client}
            teamId={teamId}
            manager={manager}
          />
        )}
        {activeTab === "contacts" && (
          <ContactsTab client={client} teamId={teamId} />
        )}
        {activeTab === "activity" && (
          <ActivityTab client={client} teamId={teamId} />
        )}
        {activeTab === "invoices" && (
          <InvoicesTab client={client} teamId={teamId} />
        )}
        {activeTab === "projects" && (
          <ProjectsTab client={client} teamId={teamId} />
        )}
        {activeTab === "files" && (
          <FilesTab client={client} teamId={teamId} />
        )}
        {activeTab === "audit" && (
          <AuditTab client={client} teamId={teamId} team={team} />
        )}
      </div>

      {/* Edit modal */}
      <EditClientModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        team={team}
        client={client}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Actions-meny (3-dots dropdown)
   ────────────────────────────────────────────────────────────────── */

function ClientActionsMenu({
  isArchived,
  onEdit,
  onArchive,
  onRestore,
  onExport,
  onHardDelete,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2">
        <Button variant="ghost" icon={Pencil} size="sm" onClick={onEdit}>
          Redigera
        </Button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-[#0052FF] hover:border-[#0052FF]/30 transition-all"
          title="Fler åtgärder"
          aria-label="Fler åtgärder"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-56 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
          <MenuItem
            icon={Download}
            label="Exportera (GDPR)"
            onClick={() => {
              setOpen(false);
              onExport();
            }}
          />
          {isArchived ? (
            <MenuItem
              icon={ArchiveRestore}
              label="Återställ"
              onClick={() => {
                setOpen(false);
                onRestore();
              }}
            />
          ) : (
            <MenuItem
              icon={Archive}
              label="Arkivera"
              onClick={() => {
                setOpen(false);
                onArchive();
              }}
            />
          )}
          <div className="border-t border-slate-100" />
          <MenuItem
            icon={Trash2}
            label="Radera permanent"
            tone="danger"
            onClick={() => {
              setOpen(false);
              onHardDelete();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, tone = "default" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-2.5 text-sm font-body text-left transition-colors",
        tone === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function slugify(s) {
  return (s || "kund")
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
