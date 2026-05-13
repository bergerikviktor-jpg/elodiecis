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
import { updateClient, checkOrgNumberExists } from "@/lib/clients";
import { INDUSTRIES, CURRENCIES } from "@/lib/schema";
import {
  isValidOrgNumber,
  normalizeOrgNumber,
  formatOrgNumber,
} from "@/lib/orgnumber";
import { cn } from "@/lib/utils";

/**
 * Redigera en befintlig kund. Speglar NewClientModal men:
 *   - Förfyller alla fält från `client`
 *   - Hoppar dubblettkollen om orgnr inte ändrats (exkluderar sig själv)
 *   - Kallar updateClient i stället för createClient
 *   - Showar alla "Mer detaljer"-fält direkt (man redigerar, vill se allt)
 */
export default function EditClientModal({ isOpen, onClose, team, client }) {
  const { user } = useAuth();
  const toast = useToast();

  const [companyName, setCompanyName] = useState("");
  const [orgInput, setOrgInput] = useState("");
  const [industry, setIndustry] = useState("");
  const [accountManagerUid, setAccountManagerUid] = useState("");

  const [orgValid, setOrgValid] = useState(false);
  const [orgDupId, setOrgDupId] = useState(null);
  const [orgChecking, setOrgChecking] = useState(false);
  const dupCheckTimer = useRef(null);

  const [billing, setBilling] = useState(emptyAddress());
  const [visit, setVisit] = useState(emptyAddress());
  const [visitSameAsBilling, setVisitSameAsBilling] = useState(false);
  const [vatNumber, setVatNumber] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState("30");
  const [defaultCurrency, setDefaultCurrency] = useState("SEK");
  const [tagsInput, setTagsInput] = useState("");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const memberUids = team?.members || [];
  const { profiles } = useUserProfiles(memberUids);

  /* ── Hydrera state från client-objektet när modalen öppnas ────── */

  useEffect(() => {
    if (!isOpen || !client) return;
    setCompanyName(client.companyName || "");
    setOrgInput(client.orgNumber || "");
    setOrgValid(isValidOrgNumber(client.orgNumberDigits || client.orgNumber || ""));
    setOrgDupId(null);
    setOrgChecking(false);
    setIndustry(client.industry || "");
    setAccountManagerUid(client.accountManagerUid || user?.uid || "");

    const b = client.billing || emptyAddress();
    const v = client.visit || emptyAddress();
    setBilling(b);
    setVisit(v);
    setVisitSameAsBilling(addressesEqual(b, v));

    setVatNumber(client.vatNumber || "");
    setPaymentTermDays(String(client.paymentTermDays ?? 30));
    setDefaultCurrency(client.defaultCurrency || "SEK");
    setTagsInput(Array.isArray(client.tags) ? client.tags.join(", ") : "");
    setNotes(client.notes || "");
    setError("");
    setSubmitting(false);
  }, [isOpen, client, user]);

  /* ── Cleanup timer ────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    };
  }, []);

  /* ── Orgnr live-check ─────────────────────────────────────────── */

  useEffect(() => {
    if (dupCheckTimer.current) clearTimeout(dupCheckTimer.current);
    setOrgDupId(null);

    const digits = normalizeOrgNumber(orgInput);
    const valid = isValidOrgNumber(digits);
    setOrgValid(valid);

    // Om orgnr inte ändrats jämfört med befintligt — hoppa dup-check.
    if (!valid || !team?.id || !client) {
      setOrgChecking(false);
      return;
    }
    if (digits === client.orgNumberDigits) {
      setOrgChecking(false);
      return;
    }

    setOrgChecking(true);
    dupCheckTimer.current = setTimeout(async () => {
      try {
        const existingId = await checkOrgNumberExists(team.id, digits, client.id);
        setOrgDupId(existingId);
      } catch (err) {
        console.error("orgnr dup check failed", err);
      } finally {
        setOrgChecking(false);
      }
    }, 400);
  }, [orgInput, team?.id, client]);

  /* ── Dropdown-options ─────────────────────────────────────────── */

  const managerOptions = useMemo(() => {
    return memberUids
      .map((uid) => {
        const p = profiles.get(uid);
        return { value: uid, label: p?.displayName || uid };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "sv"));
  }, [memberUids, profiles]);

  /* ── Submit ───────────────────────────────────────────────────── */

  const trimmedCompany = companyName.trim();
  const canSubmit =
    !submitting &&
    !!team?.id &&
    !!client &&
    !!user &&
    trimmedCompany.length > 0 &&
    orgValid &&
    !orgDupId &&
    !orgChecking;

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
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const paymentTerms = Number(paymentTermDays);

      await updateClient(team.id, client.id, user.uid, {
        companyName: trimmedCompany,
        orgNumber: orgInput,
        industry: industry || "",
        accountManagerUid,
        paymentTermDays: Number.isFinite(paymentTerms) ? paymentTerms : 30,
        defaultCurrency,
        vatNumber,
        notes,
        tags,
        billing,
        visit: visitSameAsBilling ? billing : visit,
      });
      toast.success("Kunden har uppdaterats.");
      onClose?.();
    } catch (err) {
      console.error("updateClient failed", err);
      if (err?.code === "duplicate-org-number") {
        setError("En annan kund har redan detta organisationsnummer.");
      } else {
        setError(err?.message || "Kunde inte spara.");
      }
      setSubmitting(false);
    }
  };

  if (!client) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Redigera kund"
      subtitle={`// ${client.clientNumber || client.id}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={<FieldLabel icon={Building2} text="Företagsnamn" />}
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

        {/* Adresser */}
        <SectionLabel icon={MapPin} text="Fakturaadress" />
        <AddressFields value={billing} onChange={setBilling} disabled={submitting} />

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
            <AddressFields value={visit} onChange={setVisit} disabled={submitting} />
          </>
        )}

        {/* Faktura-villkor */}
        <SectionLabel icon={CreditCard} text="Fakturavillkor" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="VAT-nummer"
            placeholder="SE556677889901"
            value={vatNumber}
            onChange={(e) => setVatNumber(e.target.value)}
            maxLength={20}
            disabled={submitting}
            className="sm:col-span-2"
          />
          <Input
            label="Betalningsvillkor (dagar)"
            type="number"
            min="0"
            step="1"
            value={paymentTermDays}
            onChange={(e) => setPaymentTermDays(e.target.value)}
            disabled={submitting}
          />
        </div>

        <Select
          label="Standardvaluta"
          value={defaultCurrency}
          onChange={(e) => setDefaultCurrency(e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c.id, label: c.label }))}
          disabled={submitting}
        />

        <Input
          label={<FieldLabel icon={Hash} text="Taggar (komma-separerade)" />}
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          maxLength={300}
          disabled={submitting}
        />

        <Textarea
          label={<FieldLabel icon={FileText} text="Intern anteckning" />}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={2000}
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
            Spara
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Delade komponenter — speglar NewClientModal men avskilda.
   (Avsiktlig duplicering: modalerna har subtilt olika life-cycle och
   det blir tydligare att läsa en åt gången än att dela en stor
   _ClientForm-komponent.)
   ────────────────────────────────────────────────────────────────── */

function OrgNumberField({ value, onChange, valid, checking, duplicate, disabled }) {
  const digits = normalizeOrgNumber(value);
  const hasTen = digits.length === 10;
  const showInvalid = digits.length > 0 && hasTen && !valid;

  let status = null;
  if (showInvalid) status = "invalid";
  else if (valid && checking) status = "checking";
  else if (valid && duplicate) status = "duplicate";
  else if (valid && !duplicate) status = "ok";

  let helper = "Format: 556677-8899 (10 siffror)";
  let tone = "muted";
  if (status === "invalid") {
    helper = "Ogiltig kontrollsiffra.";
    tone = "error";
  } else if (status === "checking") {
    helper = "Kontrollerar dubblett...";
  } else if (status === "duplicate") {
    helper = "En annan kund har redan detta orgnummer.";
    tone = "error";
  } else if (status === "ok") {
    helper = "Giltigt organisationsnummer.";
    tone = "success";
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
        <FieldLabel icon={Hash} text="Organisationsnummer" />
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => valid && onChange(formatOrgNumber(value))}
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
          tone === "error" && "text-red-500",
          tone === "success" && "text-emerald-600",
          tone === "muted" && "text-slate-500"
        )}
      >
        {helper}
      </p>
    </div>
  );
}

function emptyAddress() {
  return { address: "", postalCode: "", city: "", country: "SE" };
}

function addressesEqual(a, b) {
  const norm = (x) => ({
    address: (x?.address || "").trim(),
    postalCode: (x?.postalCode || "").trim(),
    city: (x?.city || "").trim(),
    country: (x?.country || "SE").trim().toUpperCase(),
  });
  const na = norm(a);
  const nb = norm(b);
  return (
    na.address === nb.address &&
    na.postalCode === nb.postalCode &&
    na.city === nb.city &&
    na.country === nb.country
  );
}

function AddressFields({ value, onChange, disabled }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      <Input
        label="Gatuadress"
        value={value.address}
        onChange={(e) => set("address", e.target.value)}
        maxLength={200}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label="Postnummer"
          value={value.postalCode}
          onChange={(e) => set("postalCode", e.target.value)}
          maxLength={20}
          disabled={disabled}
        />
        <Input
          label="Ort"
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
    <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider pt-2 border-t border-slate-100 mt-2">
      <Icon className="w-3 h-3" />
      {text}
    </div>
  );
}
