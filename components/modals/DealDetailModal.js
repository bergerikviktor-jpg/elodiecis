"use client";

import { useEffect, useMemo, useState } from "react";
import { Timestamp } from "firebase/firestore";
import {
  Briefcase,
  Building2,
  Tag,
  CalendarDays,
  User,
  Wallet,
  FileText,
  Layers,
  Trash2,
  Loader2,
  Crown,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Badge from "@/components/ui/Badge";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import {
  PRODUCTION_TYPES,
  deleteDeal,
  updateDeal,
} from "@/lib/deals";
import { DEAL_STAGES } from "@/lib/schema";
import { formatRelativeTime, cn } from "@/lib/utils";

/**
 * Outer guard — returns null before any hook runs when there's no
 * deal to render. All hook calls live inside DealDetailModalContent
 * to avoid Rules-of-Hooks violations on open/close.
 */
export default function DealDetailModal({ isOpen, deal, ...rest }) {
  if (!isOpen || !deal) return null;
  return <DealDetailModalContent isOpen={isOpen} deal={deal} {...rest} />;
}

function DealDetailModalContent({
  isOpen,
  onClose,
  deal,
  teamId,
  team,
  profilesById,
}) {
  const { user } = useAuth();
  const toast = useToast();

  // ── Local form state — re-seeded whenever the modal opens or the
  // displayed deal changes (e.g. realtime update from Firestore).
  const [projectName, setProjectName] = useState(deal.projectName || "");
  const [customerName, setCustomerName] = useState(deal.customerName || "");
  const [notes, setNotes] = useState(deal.notes || "");
  const [valueInput, setValueInput] = useState(
    deal.estimatedValue ? String(deal.estimatedValue) : ""
  );
  const [savingField, setSavingField] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setProjectName(deal.projectName || "");
    setCustomerName(deal.customerName || "");
    setNotes(deal.notes || "");
    setValueInput(deal.estimatedValue ? String(deal.estimatedValue) : "");
  }, [
    deal.id,
    deal.projectName,
    deal.customerName,
    deal.notes,
    deal.estimatedValue,
  ]);

  const memberOptions = useMemo(() => {
    return (team?.members || [])
      .map((uid) => {
        const p = profilesById?.get(uid);
        return { value: uid, label: p?.displayName || uid };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "sv"));
  }, [team, profilesById]);

  // Derive deadline string for <input type="date" />
  const deadlineValue = useMemo(() => {
    if (!deal.deadline) return "";
    const d = deal.deadline.toDate ? deal.deadline.toDate() : new Date(deal.deadline);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }, [deal.deadline]);

  const ownerProfile = profilesById?.get(deal.ownerUid);
  const stageMeta =
    DEAL_STAGES.find((s) => s.id === deal.stage) || DEAL_STAGES[0];

  const isOwnerOfTeam = user && team && team.ownerUid === user.uid;

  /* ── Save helpers ──────────────────────────────────────────── */

  const save = async (updates, fieldKey) => {
    if (!teamId || !deal.id) return;
    setSavingField(fieldKey || null);
    try {
      await updateDeal(teamId, deal.id, updates);
    } catch (err) {
      console.error("updateDeal failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte spara.");
    } finally {
      setSavingField(null);
    }
  };

  /* ── Field-level commits (autosave-on-blur for text, on-change
        for selects/dates/numbers since they're discrete) ──────── */

  const commitProjectName = async () => {
    const t = projectName.trim();
    if (!t || t === (deal.projectName || "")) return;
    if (t.length > 200) {
      toast.error("Projektnamnet är för långt.");
      setProjectName(deal.projectName || "");
      return;
    }
    await save({ projectName: t }, "projectName");
  };

  const commitCustomerName = async () => {
    const t = customerName.trim();
    if (!t || t === (deal.customerName || "")) return;
    if (t.length > 120) {
      toast.error("Kundnamnet är för långt.");
      setCustomerName(deal.customerName || "");
      return;
    }
    await save({ customerName: t }, "customerName");
  };

  const commitNotes = async () => {
    const t = notes.trim();
    if (t === (deal.notes || "").trim()) return;
    await save({ notes: t }, "notes");
  };

  const commitValue = async () => {
    if (valueInput === "" || valueInput === String(deal.estimatedValue || "")) return;
    const n = Number(valueInput.replace(/\s/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Värdet måste vara ett positivt heltal.");
      setValueInput(deal.estimatedValue ? String(deal.estimatedValue) : "");
      return;
    }
    await save({ estimatedValue: Math.floor(n) }, "estimatedValue");
  };

  const setProductionType = async (val) => {
    if (val === deal.productionType) return;
    if (!PRODUCTION_TYPES.find((t) => t.id === val)) return;
    await save({ productionType: val }, "productionType");
  };

  const setStage = async (val) => {
    if (val === deal.stage) return;
    if (!DEAL_STAGES.find((s) => s.id === val)) return;
    await save({ stage: val }, "stage");
  };

  const setOwner = async (val) => {
    if (val === deal.ownerUid) return;
    await save({ ownerUid: val }, "ownerUid");
  };

  const setDeadline = async (yyyymmdd) => {
    if (!yyyymmdd) {
      if (deal.deadline) await save({ deadline: null }, "deadline");
      return;
    }
    const [y, m, d] = yyyymmdd.split("-").map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    await save({ deadline: Timestamp.fromDate(date) }, "deadline");
  };

  /* ── Delete ──────────────────────────────────────────────────── */

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDeal(teamId, deal.id);
      toast.success(`"${deal.projectName}" har tagits bort.`);
      onClose?.();
    } catch (err) {
      console.error("deleteDeal failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte ta bort affären.");
      setDeleting(false);
    }
  };

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Affär"
      subtitle={`// pipeline.deal · ${deal.id?.slice(0, 8)}…`}
      size="lg"
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6">
        {/* ── Main column ─────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Title — project name */}
          <div>
            <textarea
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={commitProjectName}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.target.blur();
                }
              }}
              rows={1}
              maxLength={200}
              placeholder="Projektnamn..."
              className="w-full resize-none text-xl font-heading text-slate-900 tracking-tight border-none px-0 py-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-slate-400 bg-transparent leading-tight"
            />
            {savingField === "projectName" && (
              <p className="text-[10px] text-slate-400 font-mono">sparar...</p>
            )}
          </div>

          {/* Stage badge + production type — quick visual cue */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={stageMeta.color} size="sm">
              {stageMeta.label}
            </Badge>
            <Badge color="#0052FF" size="sm">
              {PRODUCTION_TYPES.find((t) => t.id === deal.productionType)?.label ||
                deal.productionType}
            </Badge>
          </div>

          {/* Customer */}
          <FieldGroup icon={Building2} label="Kund">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={commitCustomerName}
              maxLength={120}
              placeholder="Företaget..."
            />
            {savingField === "customerName" && (
              <p className="text-[10px] text-slate-400 font-mono mt-1">sparar...</p>
            )}
          </FieldGroup>

          {/* Notes */}
          <FieldGroup icon={FileText} label="Anteckningar / brief">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commitNotes}
              rows={5}
              placeholder="Kort brief, kundkrav, specialvillkor..."
            />
            {savingField === "notes" && (
              <p className="text-[10px] text-slate-400 font-mono mt-1">sparar...</p>
            )}
          </FieldGroup>
        </div>

        {/* ── Sidebar — properties ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Stage selector */}
          <PropertyBox icon={Layers} title="Stadium">
            <select
              value={deal.stage || "lead"}
              onChange={(e) => setStage(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
            >
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </PropertyBox>

          {/* Production type */}
          <PropertyBox icon={Tag} title="Produktionstyp">
            <select
              value={deal.productionType || "video"}
              onChange={(e) => setProductionType(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
            >
              {PRODUCTION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </PropertyBox>

          {/* Value */}
          <PropertyBox icon={Wallet} title="Estimerat värde">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1000"
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                onBlur={commitValue}
                placeholder="0"
                className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
              />
              <span className="text-[10px] font-mono text-slate-400 px-1">SEK</span>
            </div>
          </PropertyBox>

          {/* Deadline */}
          <PropertyBox icon={CalendarDays} title="Deadline">
            <input
              type="date"
              value={deadlineValue}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
            />
          </PropertyBox>

          {/* Owner */}
          <PropertyBox icon={User} title="Ansvarig kollega">
            <select
              value={deal.ownerUid || ""}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-700 focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all"
            >
              {memberOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {ownerProfile && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <Avatar
                  name={ownerProfile.displayName}
                  src={ownerProfile.photoURL}
                  size="xs"
                />
                <span className="text-[10px] text-slate-500 font-mono truncate">
                  {ownerProfile.email}
                </span>
              </div>
            )}
          </PropertyBox>

          {/* Delete */}
          <div className="pt-2 border-t border-slate-100">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-mono leading-relaxed">
                  Säker på att du vill radera affären? Kan inte ångras.
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="danger"
                    icon={Trash2}
                    loading={deleting}
                    onClick={handleDelete}
                    className="flex-1"
                  >
                    Radera
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                  >
                    Avbryt
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Ta bort affär
              </button>
            )}
          </div>

          {/* Metadata */}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <MetaRow
              label="Skapad"
              value={deal.createdAt ? formatRelativeTime(deal.createdAt) : "—"}
            />
            {deal.updatedAt && deal.updatedAt !== deal.createdAt && (
              <MetaRow
                label="Senast ändrad"
                value={formatRelativeTime(deal.updatedAt)}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────── */

function FieldGroup({ icon: Icon, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest">
        <Icon className="w-3 h-3" />
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function PropertyBox({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest px-1">
        <Icon className="w-3 h-3" />
        <span>{title}</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-2">
        {children}
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[10px] font-mono text-slate-500 truncate">
        {value}
      </span>
    </div>
  );
}
