"use client";

import { useChat } from "@/contexts/ChatContext";
import ChatPopup from "@/components/chat/ChatPopup";

/**
 * Bottom-right docking container for chat popups. Sits to the LEFT of
 * the floating ChatBubble (which lives at right-6) so the bubble is
 * never occluded. Each popup is independent: minimize / close affects
 * only itself.
 */
export default function ChatDock() {
  const { openChats } = useChat();

  if (openChats.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 right-24 z-40 flex items-end gap-3 pointer-events-none"
      aria-label="Chattfönster"
    >
      {openChats.map((c) => (
        <div key={c.conversationId} className="pointer-events-auto">
          <ChatPopup conversationId={c.conversationId} minimized={c.minimized} />
        </div>
      ))}
    </div>
  );
}
