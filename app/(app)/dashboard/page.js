"use client";

import Header from "@/components/layout/Header";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import {
  Users, Kanban, FolderKanban, TrendingUp, ArrowRight,
  Clock, DollarSign,
} from "lucide-react";
import Link from "next/link";

const stats = [
  { label: "Aktiva kunder", value: "12", change: "+2", icon: Users, iconColor: "text-[#0052FF]", iconBg: "bg-blue-50 border-blue-200", href: "/clients" },
  { label: "Öppna affärer", value: "8", change: "+3", icon: Kanban, iconColor: "text-indigo-600", iconBg: "bg-indigo-50 border-indigo-200", href: "/pipeline" },
  { label: "Pipeline-värde", value: "1,85M kr", change: "+12%", icon: DollarSign, iconColor: "text-emerald-600", iconBg: "bg-emerald-50 border-emerald-200", href: "/pipeline" },
  { label: "Aktiva projekt", value: "5", change: "—", icon: FolderKanban, iconColor: "text-violet-600", iconBg: "bg-violet-50 border-violet-200", href: "/projects" },
];

const recentDeals = [
  { id: "1", title: "Nike Sommarkampanj", client: "Nike", stageLabel: "Pitch / Konceptutveckling", stageColor: "#a855f7", value: "450 000 kr", owner: "Erik V." },
  { id: "2", title: "Volvo EV Lansering", client: "Volvo", stageLabel: "Förhandling", stageColor: "#f97316", value: "1 200 000 kr", owner: "Anna S." },
  { id: "3", title: "Spotify Wrapped BTS", client: "Spotify", stageLabel: "Presentation skickad", stageColor: "#f59e0b", value: "350 000 kr", owner: "Erik V." },
];

const recentActivity = [
  { id: "1", content: "Ringde Anna på Nike — uppföljning i augusti angående Q4-budget", user: "Erik V.", time: "2 tim sedan" },
  { id: "2", content: "Volvo godkände koncept B för EV-lanseringen. Går vidare till förproduktion nästa vecka.", user: "Anna S.", time: "4 tim sedan" },
  { id: "3", content: "Kickoff-möte med Spotify — 3 kortfilmer för Wrapped", user: "Erik V.", time: "Igår" },
  { id: "4", content: "Skickade reviderad budgetuppdelning till H&Ms marknadsavdelning", user: "Anna S.", time: "Igår" },
];

const activeProjects = [
  { id: "1", title: "Volvo EV Lansering", client: "Volvo", phase: "Produktion", phaseColor: "#f59e0b", progress: 45, dueDate: "2026-06-15", manager: "Anna S." },
  { id: "2", title: "H&M Höstkollektion", client: "H&M", phase: "Efterproduktion", phaseColor: "#a855f7", progress: 72, dueDate: "2026-05-30", manager: "Erik V." },
  { id: "3", title: "Spotify Podcast Studio", client: "Spotify", phase: "Förproduktion", phaseColor: "#6366f1", progress: 15, dueDate: "2026-07-20", manager: "Erik V." },
];

export default function DashboardPage() {
  return (
    <>
      <Header title="Översikt" subtitle="// systemstatus: aktiv" />
      <div className="p-8 space-y-8 animate-fade-in">
        {/* Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger-children">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.label} href={stat.href}>
                <Card hover className="group">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-3xl font-heading text-slate-900 mt-1.5 tracking-tight">{stat.value}</p>
                      {stat.change !== "—" && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs font-mono font-medium text-emerald-600">{stat.change}</span>
                        </div>
                      )}
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${stat.iconBg} border flex items-center justify-center transition-all duration-300 group-hover:scale-110`}>
                      <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Tvåkolumnslayout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Affärer */}
          <Card padding="none" className="lg:col-span-2">
            <div className="px-6 pt-6 pb-3">
              <CardHeader title="Senaste affärer" subtitle="// pipeline.senaste()"
                action={<Link href="/pipeline" className="text-xs font-mono font-medium text-[#0052FF] hover:text-[#4D7CFF] flex items-center gap-1 group transition-colors uppercase tracking-wider">Visa alla <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" /></Link>}
              />
            </div>
            <div className="divide-y divide-slate-100">
              {recentDeals.map((deal) => (
                <div key={deal.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: deal.stageColor }} />
                    <div className="min-w-0">
                      <p className="text-sm font-body font-semibold text-slate-900 truncate group-hover:text-[#0052FF] transition-colors">{deal.title}</p>
                      <p className="text-xs text-slate-500 font-mono">{deal.client}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <Badge color={deal.stageColor} size="xs">{deal.stageLabel}</Badge>
                    <span className="text-sm font-mono font-medium text-gradient-accent w-28 text-right">{deal.value}</span>
                    <Avatar name={deal.owner} size="xs" />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Aktivitet — Inverted Contrast Section */}
          <Card padding="none" className="bg-[#0F172A] border-slate-800 text-white">
            <div className="px-6 pt-6 pb-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-heading text-white">Aktivitet</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">// team.logg()</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-[#0052FF] opacity-75 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#4D7CFF]" /></span>
                  <span className="text-[10px] font-mono text-[#4D7CFF] uppercase tracking-wider">Live</span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6 space-y-4">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Avatar name={item.user} size="xs" className="bg-slate-800 border-slate-700 text-[#4D7CFF] shrink-0" />
                  <div>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[#4D7CFF] font-mono">{item.user}</span>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Projekttabell */}
        <Card padding="none">
          <div className="px-6 pt-6 pb-3">
            <CardHeader title="Aktiva projekt" subtitle="// projekt.aktiva()"
              action={<Link href="/projects" className="text-xs font-mono font-medium text-[#0052FF] hover:text-[#4D7CFF] flex items-center gap-1 group transition-colors uppercase tracking-wider">Visa alla <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" /></Link>}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Projekt</th>
                  <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Fas</th>
                  <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Framsteg</th>
                  <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Deadline</th>
                  <th className="text-left px-6 py-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Ansvarig</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group">
                    <td className="px-6 py-4">
                      <p className="font-body font-semibold text-slate-900 group-hover:text-[#0052FF] transition-colors">{project.title}</p>
                      <p className="text-xs text-slate-500 font-mono">{project.client}</p>
                    </td>
                    <td className="px-6 py-4"><Badge color={project.phaseColor} size="xs">{project.phase}</Badge></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${project.progress}%`, backgroundColor: project.phaseColor }} />
                        </div>
                        <span className="text-xs font-mono text-slate-500">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs font-mono">{project.dueDate}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Avatar name={project.manager} size="xs" />
                        <span className="text-xs font-mono text-slate-500">{project.manager}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
