"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Hash,
  Tag,
  User,
  CreditCard,
  MapPin,
  FileText,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useUserProfiles } from "@/lib/useChatData";
import { createClient, checkOrgNumberExists } from "@/lib/clients";
import { INDUSTRIES } from "@/lib/schema";
import {
  isValidOrgNumber,
  normalizeOrgNumber,
  formatOrgNumber,
} from "@/lib/orgnumber";
import { cn } from "@/lib/utils";

/**
 * Modal för att skapa ny kund.
 *
 * Validering sker i tre lager:
 *   1) Klient-sidan: tomma fält, format-checks, Luhn på orgnr.
 *   2) Live dubblettkontroll: när orgnr blir Luhn-valid kör vi en
 *      query mot teamet och visar varning om det redan finns.
 *      Debouncar för att inte spamma Firestore.
 *   3) Server-side (rules + createClient-helper): backstop om något
 *      slinker förbi UI-validering.
 *
 * "Mer detaljer" är collapse:ad som default — minskar fältmängden
 * vid första anblick. Standard-kunder behöver bara företagsnamn,
 * orgnr, bransch och kundansvarig.
 */
export default function NewClientModal({
  isOpen,
  onClose,
  team,
  onCreated,
}) {
  const { user } = useAuth();
  const toast = useToast();

  // Obligatoriska + ofta-använda fält
  const [companyName, setCompanyName] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [industry, setIndustry] = useState("");
  const [accountManagerUid, setAccountManagerUid] = useState("");

  // Live orgnr-state
  const [orgValid, setOrgValid] = useState(false);
  const [orgDupId, setOrgDupId] = useState(null);
  const [orgChecking, setOrgChecking] = useState(false);
  const dupCheckTimer = useRef(null);

  // "Mer detaljer"
  const [showMore, setShowMore] = useState(false);
  const [billing, setBilling] = useState(emptyAddress());
  const [visitSameAsBilling, setVisitSameAsBilling] = useState(true);
  const [visit, setVisit] = useState(emptyAddress());
  const [vatNumber, setVatNumber] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [tagsInput, setTagsInput] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Team-medlemmar för kundansvarig-dropdown
  const memberUids = team?.members || [];
  const { profiles } = useUserProfiles(memberUids);

  /* ── Reset när modalen öppnas ─────────────────────────────────── */

  useEffect(() => {
    if (!isOpen) return;
    setCompanyName("");
    setOrgInput("");
    setOrgValid(false);
    setOrgDupId(null);
    setOrgChecking(false);
    setIndustry("");
    setAccountManagerUid(user?.uid || "");
    setShowMore(false);
    setBilling(emptyAddress());
    setVisitSameAsBilling(true);
    setVisit(emptyAddress());
    setVatNumber("");
    setPaymentTermDays("30");
    setTagsInput("");
    setNotes("");
    setError("");
    setSubmitting(false);
  }, [isOpen, user]);

  /* ── Cleanup timer vid unmount ────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    };
  }, []);

  /* ── Orgnummer: live-validering + dubblettcheck ───────────────── */

  useEffect(() => {
    // Reset dup-state varje gång orgInput ändras.
    if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    setOrgDupId(null);

    const digits = normalizeOrgNumber(orgInput);
    const valid = isValidOrgNumber(digits);
    setOrgValid(valid);

    if (!valid || !team?.id) {
      setOrgChecking(false);
      return;
    }

    // Debounce — 400ms — innan vi pingar Firestore.
    setOrgChecking(true);
    dupCheckTimer.current = setTimeout(async () => {
      try {
        const existingId = await checkOrgNumberExists(team.id, digits);
        setOrgDupId(existingId);
      } catch (err) {
        console.error("orgnr dup check failed", err);
      } finally {
        setOrgChecking(false);
      }
    }, 400);
  }, [orgInput, team?.id]);

  /* ── Dropdown-options för kundansvarig ────────────────────────── */

  const managerOptions = useMemo(() => {
    return memberUids
      .map((uid) => {
        const p = profiles.get(uid);
        return { value: uid, label: p?.displayName || uid };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "sv"));
  }, [memberUids, profiles]);

  /* ── Submit-gate ──────────────────────────────────────────────── */

  const trimmedCompany = companyName.trim();
  const canSubmit =
    !!team?.id &&
    !!user &&
    trimmedCompany.length > 0 &&
    orgValid &&
    !orgDupId &&
    !orgChecking &&
    !submitting;

  /* ── Submit ───────────────────────────────────────────────────── */

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const paymentTerms = Number(paymentTermDays);

      const result = await createClient(team.id, user.uid, {
        companyName: trimmedCompany,
        orgNumber: orgInput,
        industry: industry || "",
        accountManagerUid: accountManagerUid || user.uid,
        paymentTermDays: Number.isFinite(paymentTerms) ? paymentTerms : 30,
        vatNumber,
        notes,
        tags,
        billing,
        visit: visitSameAsBilling ? billing : visit,
      });
      toast.success(`${trimmedCompany} har lagts till (${result.clientNumber}).`);
      onCreated?.(result.id);
      onClose?.();
    } catch (err) {
      console.error("createClient failed", err?.code, err?.message);
      if (err?.code === "duplicate-org-number") {
        setError("En kund med detta organisationsnummer finns redan.");
      } else {
        setError(err?.message || "Kunde inte skapa kunden.");
      }
      setSubmitting(false);
    }
  };

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Ny kund"
      subtitle="// crm.clients.create()"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bas: namn + orgnr */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={<FieldLabel icon={Building2} text="Företagsnamn" />}
            placeholder="t.ex. Volvo Cars AB"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={200}
            disabled={submitting}
            autoFocus
            required
          />
          <OrgNumberField
            value={orgInput}
            onChange={setOrgInput}
            valid={orgValid}
            checking={orgChecking}
            duplicate={!!orgDupId}
            disabled={submitting}
          />
        </div>

        {/* Bransch + kundansvarig */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={<FieldLabel icon={Tag} text="Bransch" />}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            options={[
              { value: "", label: "— Välj bransch —" },
              ...INDUSTRIES.map((i) => ({ value: i, label: i })),
            ]}
            disabled={submitting}
          />
          {managerOptions.length > 0 ? (
            <Select
              label={<FieldLabel icon={User} text="Kundansvarig" />}
              value={accountManagerUid}
              onChange={(e) => setAccountManagerUid(e.target.value)}
              options={managerOptions}
              disabled={submitting}
            />
          ) : (
            <div className="text-xs text-slate-500 font-mono self-end pb-3">
              Inga teammedlemmar att tilldela.
            </div>
          )}
        </div>

        {/* Mer detaljer-toggle */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-[#0052FF] transition-colors"
        >
          {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showMore ? "Dölj detaljer" : "Visa fler fält (adress, faktura, taggar...)"}
        </button>

        {showMore && (
          <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in">
            {/* Fakturaadress */}
            <SectionLabel icon={MapPin} text="Fakturaadress" />
            <AddressFields
              value={billing}
              onChange={setBilling}
              disabled={submitting}
            />

            {/* Besöksadress */}
            <label className="inline-flex items-center gap-2 text-xs font-mono text-slate-600">
              <input
                type="checkbox"
                checked={visitSameAsBilling}
                onChange={(e) => setVisitSameAsBilling(e.target.checked)}
                disabled={submitting}
                className="rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF]/20"
              />
              Besöksadress är samma som faktura
            </label>
            {!visitSameAsBilling && (
              <>
                <SectionLabel icon={MapPin} text="Besöksadress" />
                <AddressFields
                  value={visit}
                  onChange={setVisit}
                  disabled={submitting}
                />
              </>
            )}

            {/* Fakturadetaljer */}
            <SectionLabel icon={CreditCard} text="Fakturavillkor" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="VAT-nummer (valfritt)"
                placeholder="SE556677889901"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
                maxLength={20}
                disabled={submitting}
              />
              <Input
                label="Betalningsvillkor (dagar)"
                type="number"
                min="0"
                step="1"
                placeholder="30"
                value={paymentTermDays}
                onChange={(e) => setPaymentTermDays(e.target.value)}
                disabled={submitting}
              />
            </div>

            <Input
              label={<FieldLabel icon={Hash} text="Taggar (komma-separerade)" />}
              placeholder="VIP, retainer, internationell"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              maxLength={300}
              disabled={submitting}
            />

            <Textarea
              label={<FieldLabel icon={FileText} text="Intern anteckning" />}
              placeholder="Kort beskrivning, kontaktpreferenser, övrigt..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={submitting}
            />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-mono">
            Kundnumret genereras automatiskt (KUND-NNNN).
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
              Avbryt
            </Button>
            <Button type="submit" loading={submitting} disabled={!canSubmit}>
              Skapa kund
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Orgnummer-fält med live status-ikon
   ────────────────────────────────────────────────────────────────── */

function OrgNumberField({ value, onChange, valid, checking, duplicate, disabled }) {
  const digits = normalizeOrgNumber(value);
  const hasTen = digits.length === 10;
  const showInvalid = digits.length > 0 && hasTen && !valid;

  let status = null; // null | "ok" | "checking" | "duplicate" | "invalid"
  if (showInvalid) status = "invalid";
  else if (valid && checking) status = "checking";
  else if (valid && duplicate) status = "duplicate";
  else if (valid && !duplicate) status = "ok";

  let helperText = "Format: 556677-8899 (10 siffror)";
  let helperTone = "muted";
  if (status === "invalid") {
    helperText = "Ogiltig kontrollsiffra — kolla att alla 10 siffror stämmer.";
    helperTone = "error";
  } else if (status === "checking") {
    helperText = "Kontrollerar dubblett...";
    helperTone = "muted";
  } else if (status === "duplicate") {
    helperText = "En kund med detta organisationsnummer finns redan.";
    helperTone = "error";
  } else if (status === "ok") {
    helperText = "Giltigt organisationsnummer.";
    helperTone = "success";
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
        <FieldLabel icon={Hash} text="Organisationsnummer" />
      </label>
      <div className="relative">
        <input
          type="text"
          placeholder="556677-8899"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            // Formattera fint på blur när allt stämmer.
            if (valid) onChange(formatOrgNumber(value));
          }}
          disabled={disabled}
          maxLength={13}
          className={cn(
            "w-full px-4 py-3 pr-10 rounded-xl bg-white border text-sm text-slate-900 placeholder:text-slate-400 font-body",
            "focus-visible:outline-none focus-visible:ring-2 transition-all duration-200",
            status === "invalid" || status === "duplicate"
              ? "border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              : status === "ok"
              ? "border-emerald-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
              : "border-slate-200 focus-visible:border-[#0052FF] focus-visible:ring-[#0052FF]/20"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {status === "checking" && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
          {status === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {(status === "invalid" || status === "duplicate") && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>
      <p
        className={cn(
          "text-xs font-mono",
          helperTone === "error" && "text-red-500",
          helperTone === "success" && "text-emerald-600",
          helperTone === "muted" && "text-slate-500"
        )}
      >
        {helperText}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Adress-formulärblock
   ────────────────────────────────────────────────────────────────── */

function emptyAddress() {
  return { address: "", postalCode: "", city: "", country: "SE" };
}

function AddressFields({ value, onChange, disabled }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      <Input
        label="Gatuadress"
        placeholder="Storgatan 1"
        value={value.address}
        onChange={(e) => set("address", e.target.value)}
        maxLength={200}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Postnummer"
          placeholder="111 22"
          value={value.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          maxLength={20}
          disabled={disabled}
        />
        <Input
          label="Ort"
          placeholder="Stockholm"
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
          maxLength={100}
          disabled={disabled}
          className="sm:col-span-2"
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Små UI-helpers
   ────────────────────────────────────────────────────────────────── */

function FieldLabel({ icon: Icon, text }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="w-3 h-3" />
      {text}
    </span>
  );
}

function SectionLabel({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider">
      <Icon className="w-3 h-3" />
      {text}
    </div>
  );
}
