"use client";

import { useState } from "react";
import {
  Plus,
  StickyNote,
  Phone,
  Mail,
  Users,
  Trash2,
  Loader2,
} from "lucide-react";

import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";

import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { useClientActivityLogs } from "@/lib/useClientsData";
import { useUserProfiles } from "@/lib/useChatData";
import { deleteActivityLog } from "@/lib/clients";
import { formatDate, formatRelativeTime, cn } from "@/lib/utils";
import AddActivityModal from "@/components/modals/AddActivityModal";

const TYPE_META = {
  note: { label: "Anteckning", icon: StickyNote, color: "#6366f1" },
  call: { label: "Samtal", icon: Phone, color: "#22c55e" },
  email: { label: "E-post", icon: Mail, color: "#0052FF" },
  meeting: { label: "Möte", icon: Users, color: "#f59e0b" },
};

export default function ActivityTab({ client, teamId }) {
  const { user } = useAuth();
  const toast = useToast();
  const { logs, loading } = useClientActivityLogs(teamId, client.id);

  const [createOpen, setCreateOpen] = useState(false);

  // Profiler för alla författare i loggen
  const authorUids = Array.from(new Set(logs.map((l) => l.authorUid).filter(Boolean)));
  const { profiles } = useUserProfiles(authorUids);

  const handleDelete = async (log) => {
    if (!user) return;
    if (!window.confirm("Ta bort den här posten? Det går inte att ångra.")) return;
    try {
      await deleteActivityLog(teamId, client.id, log.id, user.uid);
      toast.success("Post borttagen.");
    } catch (err) {
      console.error("deleteActivityLog failed", err);
      toast.error(err.message || "Kunde inte ta bort.");
    }
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-body font-bold text-slate-900">
          Aktivitetslogg
          <span className="ml-2 text-xs font-mono font-normal text-slate-400">
            {logs.length} {logs.length === 1 ? "post" : "poster"}
          </span>
        </h3>
        <Button icon={Plus} size="sm" onClick={() => setCreateOpen(true)}>
          Logga händelse
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#0052FF] animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={StickyNote}
            title="Tom logg"
            description="Logga anteckningar, samtal, möten eller mejl för att bygga en historik."
            action={
              <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                Logga händelse
              </Button>
            }
          />
        </Card>
      ) : (
        <ol className="relative space-y-3 pl-8">
          {/* Vertikal tidslinje */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-200" />

          {logs.map((log) => {
            const meta = TYPE_META[log.type] || TYPE_META.note;
            const Icon = meta.icon;
            const author = profiles.get(log.authorUid);
            return (
              <li key={log.id} className="relative">
                <span
                  className="absolute -left-[26px] top-3 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-slate-50"
                  style={{ backgroundColor: meta.color }}
                  title={meta.label}
                >
                  <Icon className="w-3 h-3 text-white" />
                </span>
                <Card className="ml-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-widest font-semibold" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatDate(log.occurredAt)}
                          {" · "}
                          {formatRelativeTime(log.occurredAt)}
                        </span>
                      </div>
                      {log.title && (
                        <p className="text-sm font-body font-semibold text-slate-900 mb-1">
                          {log.title}
                        </p>
                      )}
                      {log.body && (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {log.body}
                        </p>
                      )}
                      {author && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                          <Avatar
                            name={author.displayName}
                            src={author.photoURL}
                            size="xs"
                          />
                          <span className="text-[10px] font-mono text-slate-500">
                            {author.displayName}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(log)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      title="Ta bort"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <AddActivityModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        teamId={teamId}
        clientId={client.id}
      />
    </div>
  );
}
