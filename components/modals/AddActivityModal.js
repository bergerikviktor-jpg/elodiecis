"use client";

import { useEffect, useState } from "react";
import { StickyNote, Phone, Mail, Users, Tag, CalendarDays, FileText } from "lucide-react";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/FormFields";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { addActivityLog } from "@/lib/clients";
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "note", label: "Anteckning", icon: StickyNote, color: "#6366f1" },
  { id: "call", label: "Samtal", icon: Phone, color: "#22c55e" },
  { id: "email", label: "E-post", icon: Mail, color: "#0052FF" },
  { id: "meeting", label: "Möte", icon: Users, color: "#f59e0b" },
];

export default function AddActivityModal({ isOpen, onClose, teamId, clientId }) {
  const { user } = useAuth();
  const toast = useToast();

  const [type, setType] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setType("note");
    setTitle("");
    setBody("");
    // Default till "nu" i datetime-local-format (YYYY-MM-DDTHH:mm)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    setOccurredAt(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
    );
    setSubmitting(false);
    setError("");
  }, [isOpen]);

  const canSubmit =
    !submitting &&
    !!teamId &&
    !!clientId &&
    !!user &&
    (title.trim().length > 0 || body.trim().length > 0);

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
      await addActivityLog(teamId, clientId, user.uid, {
        type,
        title: title.trim(),
        body: body.trim(),
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      });
      toast.success("Händelse loggad.");
      onClose?.();
    } catch (err) {
      console.error("addActivityLog failed", err);
      setError(err.message || "Kunde inte logga.");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Logga händelse"
      subtitle="// client.activity.add()"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Typ-väljare som ikon-knappar */}
        <div>
          <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider mb-2">
            <Tag className="w-3 h-3 inline mr-1" />
            Typ
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  disabled={submitting}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-200",
                    active
                      ? "border-[#0052FF] bg-blue-50 text-[#0052FF]"
                      : "border-slate-200 bg-white text-slate-500 hover:border-[#0052FF]/30"
                  )}
                  style={active ? { borderColor: t.color, color: t.color, background: `${t.color}10` } : {}}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Titel"
          placeholder="Kort sammanfattning"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          disabled={submitting}
          autoFocus
        />

        <Textarea
          label={<FieldLabel icon={FileText} text="Beskrivning" />}
          placeholder="Detaljer om händelsen..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={5000}
          disabled={submitting}
        />

        <Input
          label={<FieldLabel icon={CalendarDays} text="När hände det" />}
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
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
            Logga
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
