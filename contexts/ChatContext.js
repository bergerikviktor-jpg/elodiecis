"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/lib/usePresence";
import { useConversations } from "@/lib/useChatData";
import { conversationIdFor } from "@/lib/chat";

const ChatContext = createContext(undefined);

const MAX_OPEN_POPUPS = 3;

/**
 * Global chat state. Mounted once at the (app) layout level so popups
 * and the floating panel survive page navigation.
 *
 * Identity model: open popups are keyed by `conversationId` (not by
 * other-user uid), so the same machinery handles both private and
 * group chats uniformly.
 */
export function ChatProvider({ children }) {
  const { user } = useAuth();
  usePresence(); // Heartbeat + 3-state presence starts as soon as a user is signed in.

  const { conversations, loading } = useConversations(user?.uid);
  const [openChats, setOpenChats] = useState([]); // [{ conversationId, minimized }]
  const [panelOpen, setPanelOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);

  /* ── Conversation popup management ─────────────────────────── */

  const openConversation = useCallback((conversationId) => {
    if (!conversationId) return;
    setOpenChats((prev) => {
      const existing = prev.find((c) => c.conversationId === conversationId);
      if (existing) {
        return prev.map((c) =>
          c.conversationId === conversationId ? { ...c, minimized: false } : c
        );
      }
      const next = [...prev, { conversationId, minimized: false }];
      return next.slice(-MAX_OPEN_POPUPS);
    });
    // Close the panel when a chat opens — keeps the layout from getting busy.
    setPanelOpen(false);
  }, []);

  /**
   * Backwards-compatible: open a private chat with a specific user.
   * Computes the deterministic conversationId and delegates.
   */
  const openChat = useCallback(
    (otherUid) => {
      if (!user || !otherUid || otherUid === user.uid) return;
      openConversation(conversationIdFor(user.uid, otherUid));
    },
    [user, openConversation]
  );

  const closeChat = useCallback((conversationId) => {
    setOpenChats((prev) =>
      prev.filter((c) => c.conversationId !== conversationId)
    );
  }, []);

  const toggleMinimize = useCallback((conversationId) => {
    setOpenChats((prev) =>
      prev.map((c) =>
        c.conversationId === conversationId
          ? { ...c, minimized: !c.minimized }
          : c
      )
    );
  }, []);

  /* ── Panel + new-chat modal ────────────────────────────────── */

  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const openNewChat = useCallback(() => setNewChatOpen(true), []);
  const closeNewChat = useCallback(() => setNewChatOpen(false), []);

  /* ── Aggregated unread for the bubble badge ────────────────── */

  const totalUnread = useMemo(() => {
    if (!user) return 0;
    return conversations.reduce(
      (sum, c) => sum + (c.unreadCounts?.[user.uid] || 0),
      0
    );
  }, [conversations, user]);

  const value = {
    user,
    conversations,
    conversationsLoading: loading,
    // Popup state
    openChats,
    openChat,
    openConversation,
    closeChat,
    toggleMinimize,
    // Panel state
    panelOpen,
    togglePanel,
    closePanel,
    // New-chat modal
    newChatOpen,
    openNewChat,
    closeNewChat,
    // Aggregates
    totalUnread,
    // Helpers
    conversationIdFor,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (ctx === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}
