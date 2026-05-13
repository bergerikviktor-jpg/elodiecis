"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ChatProvider, useChat } from "@/contexts/ChatContext";
import AppShell from "@/components/layout/AppShell";
import ChatDock from "@/components/chat/ChatDock";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatPanel from "@/components/chat/ChatPanel";
import NewChatModal from "@/components/modals/NewChatModal";

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const allowed = !!user && user.emailVerified;

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/login");
    }
  }, [loading, allowed, router]);

  if (loading || !allowed) return null;

  return (
    <ChatProvider>
      <AppShell>{children}</AppShell>
      <ChatPanel />
      <ChatDock />
      <ChatBubble />
      <NewChatModalHost />
    </ChatProvider>
  );
}

/**
 * Tiny shim — NewChatModal needs access to the chat context for its
 * open/close state, so we render it inside the provider. Pulling out
 * to a thin component avoids leaking the hook call to the main layout.
 */
function NewChatModalHost() {
  const { newChatOpen, closeNewChat } = useChat();
  return <NewChatModal isOpen={newChatOpen} onClose={closeNewChat} />;
}
