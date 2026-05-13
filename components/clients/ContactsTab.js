"use client";

import { useState } from "react";
import {
  Plus,
  User,
  Mail,
  Phone,
  Star,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useClientContacts } from "@/lib/useClientsData";
import { deleteContact } from "@/lib/clients";
import NewContactModal from "@/components/modals/NewContactModal";

export default function ContactsTab({ client, teamId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { contacts, loading } = useClientContacts(teamId, client.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null); // contact-objekt eller null

  const handleDelete = async (contact) => {
    if (!user) return;
    const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "kontakten";
    if (!window.confirm(`Ta bort ${name}?`)) return;
    try {
      await deleteContact(teamId, client.id, contact.id, user.uid);
      toast.success("Kontakt borttagen.");
    } catch (err) {
      console.error("deleteContact failed", err);
      toast.error(err.message || "Kunde inte ta bort.");
    }
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-body font-bold text-slate-900">
          Kontaktpersoner
          <span className="ml-2 text-xs font-mono font-normal text-slate-400">
            {contacts.length} {contacts.length === 1 ? "kontakt" : "kontakter"}
          </span>
        </h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Ny kontakt
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={User}
            title="Inga kontakter än"
            description="Lägg till företagets kontaktpersoner — minst en bör märkas som primärkontakt."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Lägg till kontakt
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onEdit={() => setEditing(c)}
              onDelete={() => handleDelete(c)}
            />
          ))}
        </div>
      )}

      <NewContactModal
        isOpen={createOpen || !!editing}
        editing={editing}
        onClose={() => {
          setCreateOpen(false);
          setEditing(null);
        }}
        teamId={teamId}
        clientId={client.id}
      />
    </div>
  );
}

function ContactCard({ contact, onEdit, onDelete }) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Namnlös";
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-body font-semibold text-slate-900 truncate">
              {name}
            </h4>
            {contact.isPrimary && (
              <Badge color="#0052FF" size="xs">
                <Star className="w-2.5 h-2.5 mr-0.5 inline" />
                Primär
              </Badge>
            )}
          </div>
          {contact.title && (
            <p className="text-xs text-slate-500 truncate">{contact.title}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
            title="Redigera"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Ta bort"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 pt-3 border-t border-slate-100">
        {contact.email ? (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-[#0052FF] font-mono"
          >
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        ) : (
          <p className="text-xs text-slate-400 font-mono inline-flex items-center gap-2">
            <Mail className="w-3 h-3" /> —
          </p>
        )}
        {contact.phone ? (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-2 text-xs text-slate-600 hover:text-[#0052FF] font-mono"
          >
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">{contact.phone}</span>
          </a>
        ) : (
          <p className="text-xs text-slate-400 font-mono inline-flex items-center gap-2">
            <Phone className="w-3 h-3" /> —
          </p>
        )}
      </div>
    </Card>
  );
}
