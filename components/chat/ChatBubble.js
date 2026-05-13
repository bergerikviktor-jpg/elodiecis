"use client";

import { MessageCircle, X } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { cn } from "@/lib/utils";

/**
 * Always-visible floating chat button at the bottom-right corner.
 * Clicking it toggles the ChatPanel above. Unread count from all
 * conversations rolls up as a badge.
 *
 * Pinned `fixed` with a high z-index so it lives above every page.
 */
export default function ChatBubble() {
  const { panelOpen, togglePanel, totalUnread } = useChat();

  return (
    <button
      type="button"
      onClick={togglePanel}
      className={cn(
        "fixed bottom-6 right-6 z-50",
        "w-14 h-14 rounded-full shadow-hover",
        "flex items-center justify-center",
        "transition-all duration-300 ease-out",
        "active:scale-95 hover:scale-105",
        panelOpen
          ? "bg-slate-900 text-white"
          : "bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white shadow-glow hover:shadow-glow-intense"
      )}
      aria-label={panelOpen ? "Stäng chattpanel" : "Öppna chattpanel"}
      aria-expanded={panelOpen}
    >
      {/* Pulse ring when there are unread messages and panel is closed. */}
      {!panelOpen && totalUnread > 0 && (
        <span className="absolute inset-0 rounded-full bg-[#0052FF] opacity-40 animate-ping" />
      )}

      <div className="relative">
        {panelOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}

        {!panelOpen && totalUnread > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-mono font-semibold flex items-center justify-center ring-2 ring-white">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </div>
    </button>
  );
}
