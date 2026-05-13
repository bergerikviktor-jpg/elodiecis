"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Briefcase,
  Building2,
  Tag,
  CalendarDays,
  User,
  Wallet,
  FileText,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import Avatar from "@/components/ui/Avatar";
import ClientPicker from "@/components/clients/ClientPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { createDeal, PRODUCTION_TYPES } from "@/lib/deals";
import { DEAL_STAGES } from "@/lib/schema";
import { cn } from "@/lib/utils";

/**
 * Create a new deal in the given team. Owner-dropdown lists every team
 * member (defaulting to the creator). All other fields are scoped to
 * media-production needs per spec.
 */
export default function NewDealModal({
  isOpen,
  onClose,
  team,                 // the currently-selected team (needed for members + teamId)
  defaultStage = "lead",
  onCreated,            // optional callback (dealId) — caller can do something post-create
}) {
  const { user } = useAuth();
  const toast = useToast();

  // Form state
  const [clientId, setClientId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [productionType, setProductionType] = useState("video");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [deadline, setDeadline] = useState("");
  const [ownerUid, setOwnerUid] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Resolve member profiles for the "Ansvarig kollega"-dropdown
  const memberUids = team?.members || [];
  const { profiles } = useUserProfiles(memberUids);

  // Reset whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setClientId(null);
    setCustomerName("");
    setProjectName("");
    setProductionType("video");
    setEstimatedValue("");
    setDeadline("");
    setOwnerUid(user?.uid || ""); // default to creator
    setNotes("");
    setError("");
    setSubmitting(false);
  }, [isOpen, user]);

  const handleClientChange = (client) => {
    setClientId(client?.id || null);
    if (client?.companyName) {
      // Auto-fyll kundnamn när en kund väljs — användaren kan
      // fortfarande redigera, men slipper skriva om.
      setCustomerName(client.companyName);
    }
  };

  // Member-options for the owner-dropdown, sorted by name
  const ownerOptions = useMemo(() => {
    return memberUids
      .map((uid) => {
        const p = profiles.get(uid);
        return {
          value: uid,
          label: p?.displayName || uid,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "sv"));
  }, [memberUids, profiles]);

  const trimmedCustomer = customerName.trim();
  const trimmedProject = projectName.trim();
  const valueAsNumber =
    estimatedValue === "" ? 0 : Number(estimatedValue.replace(/\s/g, ""));
  const validValue =
    estimatedValue === "" ||
    (Number.isFinite(valueAsNumber) && valueAsNumber >= 0);

  const valid =
    trimmedCustomer.length > 0 &&
    trimmedProject.length > 0 &&
    PRODUCTION_TYPES.find((t) => t.id === productionType) &&
    validValue;

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!valid || !team || !user) return;
    setSubmitting(true);
    try {
      const dealId = await createDeal(team.id, user.uid, {
        customerName: trimmedCustomer,
        projectName: trimmedProject,
        productionType,
        estimatedValue: valueAsNumber,
        deadline: deadline ? new Date(deadline + "T12:00:00") : null,
        ownerUid: ownerUid || user.uid,
        notes,
        stage: defaultStage,
        order: 0, // caller can override; renumber-on-drag handles it anyway
        clientId,
      });
      toast.success(`"${trimmedProject}" har lagts till.`);
      onCreated?.(dealId);
      onClose?.();
    } catch (err) {
      console.error("createDeal failed", err?.code, err?.message);
      setError(err.message || "Kunde inte skapa affären.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Ny affär"
      subtitle="// pipeline.add()"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Kund-väljare (valfri — annars freeform kundnamn) */}
        <ClientPicker
          teamId={team?.id}
          value={clientId}
          onChange={handleClientChange}
          label="Kund (valfritt)"
          placeholder="Välj befintlig kund eller hoppa över..."
          disabled={submitting}
        />

        {/* Kundnamn + projektnamn */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={<FieldLabel icon={Building2} text="Kundnamn" />}
            placeholder="t.ex. Adidas"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            maxLength={120}
            disabled={submitting || !!clientId}
            autoFocus={!clientId}
            required
          />
          <Input
            label={<FieldLabel icon={Briefcase} text="Projektnamn" />}
            placeholder="t.ex. Originals Docu-Series"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            maxLength={200}
            disabled={submitting}
            autoFocus={!!clientId}
            required
          />
        </div>

        {/* Typ + värde */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={<FieldLabel icon={Tag} text="Produktionstyp" />}
            value={productionType}
            onChange={(e) => setProductionType(e.target.value)}
            options={PRODUCTION_TYPES.map((t) => ({
              value: t.id,
              label: t.label,
            }))}
            disabled={submitting}
            required
          />
          <Input
            label={<FieldLabel icon={Wallet} text="Estimerat värde (SEK)" />}
            type="number"
            min="0"
            step="1000"
            placeholder="500000"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            disabled={submitting}
            error={
              estimatedValue !== "" && !validValue
                ? "Måste vara ett positivt heltal"
                : undefined
            }
          />
        </div>

        {/* Deadline + ansvarig */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={<FieldLabel icon={CalendarDays} text="Deadline / Publicering" />}
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={submitting}
          />
          {ownerOptions.length > 0 ? (
            <Select
              label={<FieldLabel icon={User} text="Ansvarig kollega" />}
              value={ownerUid}
              onChange={(e) => setOwnerUid(e.target.value)}
              options={ownerOptions}
              disabled={submitting}
            />
          ) : (
            <div className="text-xs text-slate-500 font-mono self-end pb-3">
              Inga teammedlemmar att tilldela.
            </div>
          )}
        </div>

        {/* Anteckningar */}
        <Textarea
          label={<FieldLabel icon={FileText} text="Anteckningar / brief" />}
          placeholder="Kort brief, kundkrav, specialvillkor..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          disabled={submitting}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-mono">
            Skapas i steg:{" "}
            <span className="text-slate-700 font-semibold">
              {DEAL_STAGES.find((s) => s.id === defaultStage)?.label || "Lead"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
              Avbryt
            </Button>
            <Button type="submit" loading={submitting} disabled={!valid}>
              Skapa affär
            </Button>
          </div>
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
