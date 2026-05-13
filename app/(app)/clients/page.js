"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Building2,
  ArrowUpRight,
  ChevronDown,
  UsersRound,
  Loader2,
  Archive,
  Hash,
} from "lucide-react";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import NewClientModal from "@/components/modals/NewClientModal";

import { useAuth } from "@/contexts/AuthContext";
import { useTeams } from "@/lib/useTeamsData";
import { useClients } from "@/lib/useClientsData";
import { useUserProfiles } from "@/lib/useChatData";
import { formatSEK } from "@/lib/profitShares";
import { cn } from "@/lib/utils";
import { normalizeOrgNumber } from "@/lib/orgnumber";

const LAST_TEAM_KEY = "elodie:clients:lastTeamId:";

export default function ClientsPage() {
  const { user } = useAuth();
  const { teams, loading: teamsLoading } = useTeams(user?.uid);

  /* ── Team-val: senast valda team per användare i localStorage ──── */

  const storageKey = user ? `${LAST_TEAM_KEY}${user.uid}` : null;
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) setSelectedTeamId(cached);
    } catch {
      /* noop */
    }
  }, [storageKey]);

  useEffect(() => {
    if (teamsLoading) return;
    if (teams.length === 0) {
      if (selectedTeamId !== null) setSelectedTeamId(null);
      return;
    }
    const stillMember = selectedTeamId
      ? teams.some((t) => t.id === selectedTeamId)
      : false;
    if (!stillMember) setSelectedTeamId(teams[0].id);
  }, [teamsLoading, teams, selectedTeamId]);

  useEffect(() => {
    if (!storageKey || !selectedTeamId) return;
    try {
      localStorage.setItem(storageKey, selectedTeamId);
    } catch {
      /* noop */
    }
  }, [storageKey, selectedTeamId]);

  /* ── Data + filter-state ──────────────────────────────────────── */

  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt"); // createdAt | companyName | updatedAt
  const { clients, loading: clientsLoading } = useClients(selectedTeamId, {
    includeArchived,
    sortBy,
    direction: sortBy === "companyName" ? "asc" : "desc",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  /* ── Client-sidans sök/filter (Firestore stödjer inte substring) ── */

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;

    const termDigits = normalizeOrgNumber(term);
    return clients.filter((c) => {
      const name = (c.companyNameLower || c.companyName || "").toLowerCase();
      if (name.includes(term)) return true;
      if (termDigits && c.orgNumberDigits && c.orgNumberDigits.includes(termDigits)) return true;
      if (c.clientNumber && c.clientNumber.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [clients, searchTerm]);

  /* ── Render guards ─────────────────────────────────────────────── */

  if (teamsLoading) {
    return (
      <>
        <Header title="Kunder" subtitle="// laddar..." />
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      </>
    );
  }

  if (teams.length === 0) {
    return (
      <>
        <Header title="Kunder" subtitle="// inga team än" />
        <div className="p-8 max-w-2xl mx-auto">
          <Card padding="none">
            <EmptyState
              icon={UsersRound}
              title="Du måste tillhöra ett team"
              description="Kunder är teambaserade. Skapa eller acceptera en inbjudan till ett team först."
              action={
                <Button onClick={() => (window.location.href = "/team")}>
                  Gå till team
                </Button>
              }
            />
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Kunder"
        subtitle={
          clientsLoading
            ? "// laddar..."
            : `// ${filteredClients.length}${
                filteredClients.length === clients.length ? "" : ` av ${clients.length}`
              } ${clients.length === 1 ? "kund" : "kunder"}`
        }
        actions={
          <Button
            icon={Plus}
            onClick={() => setCreateOpen(true)}
            disabled={!selectedTeamId}
          >
            Ny kund
          </Button>
        }
      />

      <div className="px-8 pt-4">
        <TeamPicker
          teams={teams}
          value={selectedTeamId}
          onChange={setSelectedTeamId}
        />
      </div>

      <div className="p-8 animate-fade-in">
        {/* Sök + filter-bar */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Sök på namn, orgnummer eller kundnummer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 shadow-card focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
            />
          </div>
          <SortPicker value={sortBy} onChange={setSortBy} />
          <label className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-card text-xs font-mono text-slate-600 cursor-pointer hover:border-[#0052FF]/30 transition-colors">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF]/20"
            />
            <Archive className="w-3.5 h-3.5" />
            Visa arkiverade
          </label>
        </div>

        {/* Lista */}
        {clientsLoading ? (
          <ClientsSkeleton />
        ) : clients.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Building2}
              title="Inga kunder än"
              description={`Skapa din första kund i ${selectedTeam?.name || "teamet"}. Kundnummer (KUND-NNNN) genereras automatiskt.`}
              action={
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  Ny kund
                </Button>
              }
            />
          </Card>
        ) : filteredClients.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={Search}
              title="Inga träffar"
              description={`Inget matchar "${searchTerm}". Pröva ett annat sökord eller rensa filtret.`}
              action={
                <Button variant="ghost" onClick={() => setSearchTerm("")}>
                  Rensa sökning
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 stagger-children">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                teamId={selectedTeamId}
              />
            ))}
          </div>
        )}
      </div>

      <NewClientModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        team={selectedTeam}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
   ClientCard
   ────────────────────────────────────────────────────────────────── */

function ClientCard({ client, teamId }) {
  // Plocka profil för kundansvarig (ett uid, single-element array för hooken).
  const managerUids = useMemo(
    () => (client.accountManagerUid ? [client.accountManagerUid] : []),
    [client.accountManagerUid]
  );
  const { profiles } = useUserProfiles(managerUids);
  const manager = client.accountManagerUid
    ? profiles.get(client.accountManagerUid)
    : null;

  const isArchived = client.status === "archived";
  const outstanding = client.outstandingBalance || 0;
  const activeDeals = client.activeDealsCount || 0;
  const activeProjects = client.activeProjectsCount || 0;

  return (
    <Link href={`/clients/${client.id}?team=${teamId}`}>
      <Card hover className={cn("group", isArchived && "opacity-60")}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-glow shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-body font-bold text-slate-900 group-hover:text-[#0052FF] transition-colors tracking-tight truncate">
                {client.companyName}
              </h3>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest truncate">
                {client.industry || "—"}
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:text-[#0052FF] shrink-0" />
        </div>

        {/* Kundnummer + orgnummer */}
        <div className="flex items-center gap-3 mb-4 text-[10px] font-mono">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 text-slate-600">
            <Hash className="w-3 h-3" />
            {client.clientNumber || "—"}
          </span>
          {client.orgNumber && (
            <span className="text-slate-400 truncate">{client.orgNumber}</span>
          )}
          {isArchived && (
            <Badge color="#94a3b8" size="xs">
              Arkiverad
            </Badge>
          )}
        </div>

        {/* KPI-rad */}
        <div className="flex items-center gap-5 pt-4 border-t border-slate-100">
          <Metric label="Affärer" value={activeDeals} />
          <Metric label="Projekt" value={activeProjects} />
          {outstanding > 0 && (
            <Metric
              label="Utestående"
              value={formatSEK(outstanding)}
              tone="warning"
            />
          )}
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {manager ? (
              <>
                <Avatar
                  name={manager.displayName}
                  src={manager.photoURL}
                  size="xs"
                />
                <span className="text-xs text-slate-500 font-mono truncate max-w-[100px]">
                  {manager.displayName}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">
                Ingen ansvarig
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Metric({ label, value, tone = "default" }) {
  const toneClass = {
    default: "text-slate-900",
    warning: "text-amber-600",
  }[tone];
  return (
    <div className="min-w-0">
      <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest block">
        {label}
      </span>
      <p className={cn("text-sm font-mono font-semibold mt-0.5 truncate", toneClass)}>
        {value}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   TeamPicker (samma UX som /projects och /pipeline)
   ────────────────────────────────────────────────────────────────── */

function TeamPicker({ teams, value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = teams.find((t) => t.id === value);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-card hover:border-[#0052FF]/30 transition-all duration-200"
      >
        <UsersRound className="w-4 h-4 text-slate-500" />
        <div className="text-left">
          <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest leading-none">
            Team
          </p>
          <p className="text-sm font-body font-semibold text-slate-900 leading-tight mt-0.5">
            {current?.name || "Välj team"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-20 w-72 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
            <div className="max-h-72 overflow-y-auto">
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    onChange(t.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors",
                    t.id === value
                      ? "bg-blue-50 text-[#0052FF]"
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-body font-semibold truncate">
                      {t.name}
                    </p>
                  </div>
                  {t.id === value && (
                    <span className="w-2 h-2 rounded-full bg-[#0052FF] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   SortPicker — enkel select
   ────────────────────────────────────────────────────────────────── */

function SortPicker({ value, onChange }) {
  const options = [
    { value: "createdAt", label: "Senaste" },
    { value: "updatedAt", label: "Senast uppdaterad" },
    { value: "companyName", label: "A–Ö" },
  ];
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pl-4 pr-10 py-3 rounded-xl bg-white border border-slate-200 shadow-card text-xs font-mono text-slate-600 cursor-pointer hover:border-[#0052FF]/30 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200"
        title="Sortera"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            Sortera: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      {/* Hidden för screen-reader-konsistens */}
      <span className="sr-only">{current.label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Skeleton
   ────────────────────────────────────────────────────────────────── */

function ClientsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-2 w-1/3 rounded bg-slate-100" />
              </div>
            </div>
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            <div className="flex items-center gap-5 pt-4 border-t border-slate-100">
              <div className="h-6 w-12 rounded bg-slate-100" />
              <div className="h-6 w-12 rounded bg-slate-100" />
              <div className="ml-auto h-6 w-20 rounded bg-slate-100" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
