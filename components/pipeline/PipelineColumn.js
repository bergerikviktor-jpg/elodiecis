"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import DealCard from "@/components/pipeline/DealCard";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * One stage of the pipeline. Sums deal values for the column header
 * total. Body is a droppable sortable context for dnd-kit.
 */
export default function PipelineColumn({
  stage,
  deals,
  isOver,
  profilesById,
  onOpenDeal,
}) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
    data: { type: "stage", stageId: stage.id },
  });

  const dealIds = deals.map((d) => d.id);
  const stageTotal = useMemo(
    () => deals.reduce((sum, d) => sum + (d.estimatedValue || 0), 0),
    [deals]
  );

  return (
    <div className="w-80 shrink-0 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest truncate">
            {stage.label}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
          {deals.length}
        </span>
      </div>

      {/* Stage total — prominent, right below header */}
      <div className="mb-3 px-1">
        <span className="text-base font-heading font-semibold text-[#0052FF]">
          {stageTotal > 0 ? formatCurrency(stageTotal) : "—"}
        </span>
      </div>

      {/* Body */}
      <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 space-y-3 p-3 rounded-2xl border min-h-[240px] transition-all duration-200",
            isOver
              ? "bg-blue-50 border-[#0052FF]/30 shadow-[0_0_20px_-8px_rgba(0,82,255,0.15)]"
              : "bg-slate-200/60 border-slate-200"
          )}
        >
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              ownerProfile={profilesById?.get(deal.ownerUid)}
              onOpen={onOpenDeal}
            />
          ))}
          {deals.length === 0 && (
            <div
              className={cn(
                "flex items-center justify-center h-28 text-xs font-mono border border-dashed rounded-xl transition-colors",
                isOver
                  ? "text-[#0052FF] border-[#0052FF]/30"
                  : "text-slate-400 border-slate-300"
              )}
            >
              Släpp affärer här
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
