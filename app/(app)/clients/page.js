"use client";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { Plus, Search, Building2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const clients = [
  { id: "1", companyName: "Nike", industry: "Sportswear", accountManagerName: "Erik V.", activeDealsCount: 2, activeProjectsCount: 1 },
  { id: "2", companyName: "Volvo", industry: "Fordon", accountManagerName: "Anna S.", activeDealsCount: 1, activeProjectsCount: 1 },
  { id: "3", companyName: "Spotify", industry: "Underhållning", accountManagerName: "Erik V.", activeDealsCount: 1, activeProjectsCount: 0 },
  { id: "4", companyName: "H&M", industry: "Mode", accountManagerName: "Anna S.", activeDealsCount: 0, activeProjectsCount: 1 },
  { id: "5", companyName: "IKEA", industry: "Detaljhandel", accountManagerName: "Erik V.", activeDealsCount: 1, activeProjectsCount: 0 },
];

export default function ClientsPage() {
  return (
    <>
      <Header title="Kunder" subtitle={`// ${clients.length} noder anslutna`} actions={<Button icon={Plus} size="md">Lägg till kund</Button>} />
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Sök kunder..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 shadow-card focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all duration-200" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 stagger-children">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card hover className="group">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-glow">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-body font-bold text-slate-900 group-hover:text-[#0052FF] transition-colors tracking-tight">{client.companyName}</h3>
                      <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{client.industry}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:text-[#0052FF]" />
                </div>

                <div className="flex items-center gap-5 pt-4 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Affärer</span>
                    <p className="text-lg font-heading text-slate-900">{client.activeDealsCount}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Projekt</span>
                    <p className="text-lg font-heading text-slate-900">{client.activeProjectsCount}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Avatar name={client.accountManagerName} size="xs" />
                    <span className="text-xs text-slate-500 font-mono">{client.accountManagerName}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
