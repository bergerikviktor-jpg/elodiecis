"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Building2, ChevronDown, Search, X, Hash } from "lucide-react";

import { useClients } from "@/lib/useClientsData";
import { cn } from "@/lib/utils";

/**
 * Återanvändbar kundväljare.
 *
 * Visar en knapp som öppnar en sök-list-popover med teamets aktiva
 * kunder. Caller hanterar valet via `value` (clientId) + `onChange`
 * som får hela kund-objektet (eller null vid "Ingen kund").
 *
 * Designval:
 *   - "Ingen kund" är alltid valbart — vi vill stödja flexibla flöden
 *     där man fyller i en kund senare.
 *   - Kunder hämtas via useClients-hooken (realtime). Skapas en kund
 *     i bakgrunden dyker den upp i listan direkt.
 *   - Sök filtrerar både companyName och clientNumber.
 *   - Knappens label visar antingen valt-kund-namn + nummer eller
 *     placeholder.
 */
export default function ClientPicker({
  teamId,
  value, // clientId | null
  onChange, // (client | null) => void
  label = "Kund",
  placeholder = "Välj kund...",
  required = false,
  disabled = false,
}) {
  const { clients, loading } = useClients(teamId, { sortBy: "companyName" });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const searchRef = useRef(null);

  // Click-outside close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fokusera sökrutan när popovern öppnas
  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const selectedClient = useMemo(
    () => (value ? clients.find((c) => c.id === value) || null : null),
    [value, clients]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((c) => {
      const name = (c.companyNameLower || c.companyName || "").toLowerCase();
      if (name.includes(term)) return true;
      if (c.clientNumber && c.clientNumber.toLowerCase().includes(term)) return true;
      if (c.orgNumberDigits && c.orgNumberDigits.includes(term.replace(/\D/g, ""))) return true;
      return false;
    });
  }, [clients, search]);

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && (
        <label className="block text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
          <Building2 className="w-3 h-3 inline mr-1" />
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white border text-sm text-left transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 focus-visible:border-[#0052FF]",
            open
              ? "border-[#0052FF] ring-2 ring-[#0052FF]/20"
              : "border-slate-200 hover:border-[#0052FF]/30",
            disabled && "opacity-60 cursor-not-allowed"
          )}
        >
          {selectedClient ? (
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <span className="w-6 h-6 rounded-md bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center shrink-0">
                <Building2 className="w-3 h-3 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-body font-medium text-slate-900 truncate">
                  {selectedClient.companyName}
                </span>
                <span className="block text-[10px] font-mono text-slate-400">
                  {selectedClient.clientNumber}
                </span>
              </span>
            </span>
          ) : (
            <span className="text-slate-400 font-body">{placeholder}</span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-400 transition-transform shrink-0",
              open && "rotate-180"
            )}
          />
        </button>

        {/* Clear-knapp när nåt är valt */}
        {selectedClient && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.(null);
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Ta bort val"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {open && (
          <div className="absolute z-30 left-0 right-0 top-full mt-2 rounded-xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in">
            {/* Sökfält */}
            <div className="relative border-b border-slate-100">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Sök kund..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm font-body bg-transparent border-0 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            {/* "Ingen kund" */}
            <button
              type="button"
              onClick={() => {
                onChange?.(null);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors border-b border-slate-100",
                !value
                  ? "bg-blue-50 text-[#0052FF]"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <span className="w-6 h-6 rounded-md border border-dashed border-slate-300 flex items-center justify-center shrink-0">
                <X className="w-3 h-3 text-slate-400" />
              </span>
              <span className="font-body italic">Ingen kund</span>
            </button>

            {/* Lista */}
            <div className="max-h-64 overflow-y-auto">
              {loading ? (
                <p className="px-3 py-3 text-xs text-slate-400 font-mono">
                  Laddar...
                </p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-slate-400 font-mono">
                  {search ? "Inga träffar." : "Inga kunder än."}
                </p>
              ) : (
                filtered.map((c) => {
                  const selected = c.id === value;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onChange?.(c);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors",
                        selected
                          ? "bg-blue-50 text-[#0052FF]"
                          : "hover:bg-slate-50"
                      )}
                    >
                      <span className="w-6 h-6 rounded-md bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center shrink-0">
                        <Building2 className="w-3 h-3 text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-body font-medium text-slate-900 truncate">
                          {c.companyName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 inline-flex items-center gap-1">
                          <Hash className="w-2.5 h-2.5" />
                          {c.clientNumber}
                          {c.industry && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{c.industry}</span>
                            </>
                          )}
                        </span>
                      </span>
                      {selected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
