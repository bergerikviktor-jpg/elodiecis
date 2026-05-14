"use client";

import { useEffect, useState } from "react";
import { User, Briefcase, Mail, Phone, Star } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { addContact, updateContact } from "@/lib/clients";
import { cn } from "@/lib/utils";

/**
 * Skapa eller redigera en kontaktperson.
 *
 * Modalen dubbeltjänstgör: om `editing`-prop är ett kontaktobjekt
 * → edit-läge, annars create-läge.
 */
export default function NewContactModal({
  isOpen,
  onClose,
  teamId,
  clientId,
  editing,
}) {
  const { user } = useAuth();
  const toast = useToast();

  const isEdit = !!editing;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSubmitting(false);
    if (editing) {
      setFirstName(editing.firstName || "");
      setLastName(editing.lastName || "");
      setTitle(editing.title || "");
      setEmail(editing.email || "");
      setPhone(editing.phone || "");
      setIsPrimary(!!editing.isPrimary);
    } else {
      setFirstName("");
      setLastName("");
      setTitle("");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
    }
  }, [isOpen, editing]);

  const canSubmit =
    !submitting &&
    !!teamId &&
    !!clientId &&
    !!user &&
    (firstName.trim().length > 0 || lastName.trim().length > 0);

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
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim(),
        email: email.trim(),
        phone: phone.trim(),
        isPrimary,
      };
      if (isEdit) {
        await updateContact(teamId, clientId, editing.id, user.uid, payload);
        toast.success("Kontakt uppdaterad.");
      } else {
        await addContact(teamId, clientId, user.uid, payload);
        toast.success("Kontakt tillagd.");
      }
      onClose?.();
    } catch (err) {
      console.error("addContact/updateContact failed", err);
      setError(err.message || "Kunde inte spara kontakten.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={isEdit ? "Redigera kontakt" : "Ny kontakt"}
      subtitle={isEdit ? "// client.contact.update()" : "// client.contact.add()"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-8 py-2">
        {/* Sektion: Personuppgifter */}
        <Section
          title="Personuppgifter"
          description="Vem är personen — namn och roll på företaget."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={<FieldLabel icon={User} text="Förnamn" />}
              placeholder="Anna"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={100}
              disabled={submitting}
              autoFocus
            />
            <Input
              label={<FieldLabel icon={User} text="Efternamn" />}
              placeholder="Andersson"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={100}
              disabled={submitting}
            />
          </div>
          <Input
            label={<FieldLabel icon={Briefcase} text="Titel / roll" />}
            placeholder="Marknadschef, COO, Inköpare..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            disabled={submitting}
          />
        </Section>

        {/* Sektion: Kontaktuppgifter */}
        <Section
          title="Kontaktuppgifter"
          description="Hur du når personen direkt."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={<FieldLabel icon={Mail} text="E-post" />}
              type="email"
              placeholder="anna@bolaget.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
            <Input
              label={<FieldLabel icon={Phone} text="Telefon" />}
              placeholder="+46 70 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
              disabled={submitting}
            />
          </div>
        </Section>

        {/* Sektion: Inställningar */}
        <Section
          title="Inställningar"
          description="Primärkontakten visas högst upp på kundkortet."
        >
          <label
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors",
              isPrimary
                ? "border-[#0052FF] bg-blue-50"
                : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              disabled={submitting}
              className="rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF]/20"
            />
            <Star
              className={cn(
                "w-4 h-4",
                isPrimary ? "text-[#0052FF]" : "text-slate-400"
              )}
            />
            <span className="text-sm font-body text-slate-700">
              Markera som primärkontakt
            </span>
          </label>
        </Section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-xs text-red-600 font-mono">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="ghost" type="button" onClick={close} disabled={submitting}>
            Avbryt
          </Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            {isEdit ? "Spara ändringar" : "Lägg till kontakt"}
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

/**
 * Sektion med rubrik + beskrivning + innehåll, separerad från andra
 * sektioner med ett tunt avgränsnings-streck. Ger formuläret en
 * tydligare visuell hierarki och fyller höjd utan att kännas tomt.
 */
function Section({ title, description, children }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1 pb-2 border-b border-slate-100">
        <h3 className="text-xs font-mono font-semibold text-slate-900 uppercase tracking-widest">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-slate-500 font-body">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
