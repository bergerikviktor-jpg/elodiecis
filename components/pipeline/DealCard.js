"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, GripVertical, Eye } from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { productionTypeLabel } from "@/lib/deals";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Sortable deal card. Minimal styling per step-1 brief — focus on
 * shape and behaviour. Polish comes in a later pass.
 */
export default function DealCard({ deal, ownerProfile, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, data: { deal } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const deadlineLabel = useMemo(() => {
    if (!deal.deadline) return null;
    const date = deal.deadline.toDate
      ? deal.deadline.toDate()
      : new Date(deal.deadline);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "short",
      year:
        date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  }, [deal.deadline]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 rounded-xl bg-white border border-slate-200 shadow-sm transition-all duration-200 group",
        isDragging
          ? "opacity-30 scale-95"
          : "hover:-translate-y-0.5 hover:border-[#0052FF]/30 hover:shadow-md"
      )}
      onClick={(e) => {
        if (isDragging) return;
        onOpen?.(deal);
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 rounded text-slate-300 hover:text-[#0052FF] cursor-grab active:cursor-grabbing transition-colors shrink-0 touch-none"
          aria-label="Dra för att flytta"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body font-semibold text-slate-900 truncate leading-snug">
            {deal.projectName}
          </p>
          <p className="text-xs text-slate-500 font-mono truncate mt-0.5">
            {deal.customerName}
          </p>
        </div>
        {/* Eye / open-detail icon — explicit affordance. Card-wide
            click also opens the modal, but the eye gives a clear
            visual cue and is safe from drag-distance accidents. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen?.(deal);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-all duration-200 shrink-0"
          aria-label="Öppna affärsdetaljer"
          title="Visa & redigera"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Production type pill */}
      <div className="mb-2">
        <Badge color="#0052FF" size="xs">
          {productionTypeLabel(deal.productionType)}
        </Badge>
      </div>

      {/* Footer: value, deadline, owner */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
        <div className="min-w-0">
          <p className="text-sm font-mono font-semibold text-[#0052FF] truncate">
            {deal.estimatedValue > 0 ? formatCurrency(deal.estimatedValue) : "—"}
          </p>
          {deadlineLabel && (
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 inline-flex items-center gap-1">
              <CalendarDays className="w-2.5 h-2.5" />
              {deadlineLabel}
            </p>
          )}
        </div>
        <Avatar
          name={ownerProfile?.displayName}
          src={ownerProfile?.photoURL}
          size="xs"
          className="shrink-0"
        />
      </div>
    </div>
  );
}
