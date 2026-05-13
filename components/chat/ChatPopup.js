"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Minus,
  Maximize2,
  Send,
  Paperclip,
  Smile,
  FileText,
  Download,
  Loader2,
  Users,
} from "lucide-react";

import Avatar from "@/components/ui/Avatar";
import EmojiPicker from "@/components/chat/EmojiPicker";
import ImageLightbox from "@/components/chat/ImageLightbox";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { useToast } from "@/contexts/ToastContext";
import {
  useConversation,
  useMessages,
  useUserDoc,
  useUserProfiles,
} from "@/lib/useChatData";
import {
  conversationIdFor,
  ensurePrivateConversation,
  markConversationRead,
  sendFileMessage,
  sendTextMessage,
  setTyping,
  clearTyping,
} from "@/lib/chat";
import { presenceLabel } from "@/lib/usePresence";
import { cn } from "@/lib/utils";

const TYPING_FRESH_MS = 5000;
const TYPING_THROTTLE_MS = 2500;

export default function ChatPopup({ conversationId, minimized }) {
  const { user } = useAuth();
  const { closeChat, toggleMinimize } = useChat();

  const { conversation } = useConversation(conversationId);
  const { messages, loading: messagesLoading } = useMessages(conversationId, user?.uid);

  // Conversation type drives most of the UI. Old chats without an
  // explicit `type` field are treated as private (2-person).
  const isGroup = conversation?.type === "group";
  const otherUid = useMemo(() => {
    if (!user || !conversation || isGroup) return null;
    return conversation.participants?.find((u) => u !== user.uid) || null;
  }, [user, conversation, isGroup]);

  // Realtime profile of the "other" user (private only).
  const { profile: other } = useUserDoc(otherUid);

  // For groups, fetch every participant's profile so we can show
  // sender names + typing indicator names.
  const groupParticipantUids = useMemo(() => {
    if (!isGroup || !user) return [];
    return (conversation?.participants || []).filter((u) => u !== user.uid);
  }, [isGroup, user, conversation]);
  const { profiles: groupProfiles } = useUserProfiles(groupParticipantUids);

  // Ensure a private conversation doc exists as soon as the popup
  // opens for the first time. For groups the doc is already there
  // (created via createGroupConversation).
  useEffect(() => {
    if (!user || !conversationId || isGroup) return;
    // Only run if the doc doesn't exist yet — figure that out from the
    // already-loaded conversation snapshot.
    if (conversation !== null) return;
    // The convId for private chats encodes both uids ("uidA_uidB").
    const [a, b] = conversationId.split("_");
    if (!a || !b) return;
    ensurePrivateConversation(a, b).catch((err) =>
      console.warn("ensurePrivateConversation failed:", err?.code || err?.message)
    );
  }, [user, conversationId, isGroup, conversation]);

  // Mark unread messages as read whenever the popup is open + active.
  useEffect(() => {
    if (minimized || !user || !conversationId || messages.length === 0) return;
    markConversationRead(conversationId, user.uid, messages);
  }, [minimized, user, conversationId, messages]);

  /* ── Typing indicator (which other participants are typing) ── */
  const typingUids = useMemo(() => {
    const typingMap = conversation?.typing || {};
    return Object.entries(typingMap)
      .filter(([uid, ts]) => {
        if (!user || uid === user.uid || !ts) return false;
        const ms = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
        return Date.now() - ms < TYPING_FRESH_MS;
      })
      .map(([uid]) => uid);
  }, [conversation, user]);

  // Re-render every 2s so the relative timestamps + typing freshness stay accurate.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 2000);
    return () => clearInterval(id);
  }, []);

  /* ── Header info — different for private vs group ──────────── */
  const headerInfo = useMemo(() => {
    if (isGroup) {
      const count = (conversation?.participants?.length || 0);
      return {
        title: conversation?.groupName || "Gruppchatt",
        subtitle: `${count} deltagare`,
        avatar: { name: conversation?.groupName, src: conversation?.groupPhoto, isGroup: true },
        presence: null,
      };
    }
    const presence = presenceLabel(other);
    return {
      title: other?.displayName || "Laddar...",
      subtitle: presence.label,
      avatar: { name: other?.displayName, src: other?.photoURL, isGroup: false },
      presence,
    };
  }, [isGroup, conversation, other]);

  // Typing label
  const typingLabel = useMemo(() => {
    if (typingUids.length === 0) return null;
    if (!isGroup) return "skriver...";
    const names = typingUids
      .map((uid) => groupProfiles.get(uid)?.firstName || groupProfiles.get(uid)?.displayName?.split(" ")[0])
      .filter(Boolean);
    if (names.length === 0) return "Någon skriver...";
    if (names.length === 1) return `${names[0]} skriver...`;
    if (names.length === 2) return `${names[0]} och ${names[1]} skriver...`;
    return "Flera skriver...";
  }, [typingUids, isGroup, groupProfiles]);

  /* ── Header (compact when minimized) ─────────────────────────── */

  const headerRow = (
    <div
      className={cn(
        "flex items-center gap-2 px-3 h-12 border-b border-slate-200 bg-white",
        minimized ? "cursor-pointer" : ""
      )}
      onClick={minimized ? () => toggleMinimize(conversationId) : undefined}
    >
      <div className="relative shrink-0">
        {headerInfo.avatar.isGroup ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center text-white shadow-glow">
            <Users className="w-4 h-4" />
          </div>
        ) : (
          <Avatar name={headerInfo.avatar.name} src={headerInfo.avatar.src} size="sm" />
        )}
        {headerInfo.presence && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
            style={{ backgroundColor: headerInfo.presence.dotColor }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-body font-semibold text-slate-900 truncate leading-none">
          {headerInfo.title}
        </p>
        <p className="text-[10px] text-slate-500 font-mono truncate mt-1">
          {typingLabel || headerInfo.subtitle}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleMinimize(conversationId);
        }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors"
        aria-label={minimized ? "Maximera" : "Minimera"}
      >
        {minimized ? (
          <Maximize2 className="w-3.5 h-3.5" />
        ) : (
          <Minus className="w-3.5 h-3.5" />
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          closeChat(conversationId);
        }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label="Stäng"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  if (minimized) {
    const unread = conversation?.unreadCounts?.[user?.uid] || 0;
    return (
      <div className="w-72 rounded-t-2xl bg-white border border-b-0 border-slate-200 shadow-hover overflow-hidden relative">
        {unread > 0 && (
          <div className="absolute top-1 right-16 z-10 min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-mono font-semibold flex items-center justify-center shadow">
            {unread > 9 ? "9+" : unread}
          </div>
        )}
        {headerRow}
      </div>
    );
  }

  return (
    <div className="w-80 h-[480px] rounded-t-2xl bg-white border border-b-0 border-slate-200 shadow-hover overflow-hidden flex flex-col">
      {headerRow}
      <MessageList
        messages={messages}
        myUid={user?.uid}
        loading={messagesLoading}
        typingActive={!!typingLabel}
        typingLabel={typingLabel}
        isGroup={isGroup}
        otherProfile={other}
        groupProfiles={groupProfiles}
        groupName={conversation?.groupName}
      />
      <MessageInput
        conversationId={conversationId}
        participants={conversation?.participants}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MessageList — scrollable area with date separators
   ────────────────────────────────────────────────────────────────── */

function MessageList({
  messages,
  myUid,
  loading,
  typingActive,
  typingLabel,
  isGroup,
  otherProfile,
  groupProfiles,
  groupName,
}) {
  const scrollRef = useRef(null);
  const lastCountRef = useRef(0);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length > lastCountRef.current || typingActive) {
      el.scrollTop = el.scrollHeight;
    }
    lastCountRef.current = messages.length;
  }, [messages, typingActive]);

  const grouped = useMemo(() => groupMessagesByDay(messages), [messages]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50">
        <Loader2 className="w-5 h-5 text-[#0052FF] animate-spin" />
      </div>
    );
  }

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] flex items-center justify-center mb-3 shadow-glow">
          {isGroup ? (
            <Users className="w-5 h-5 text-white" />
          ) : (
            <Avatar
              name={otherProfile?.displayName}
              src={otherProfile?.photoURL}
              size="sm"
              className="ring-2 ring-white"
            />
          )}
        </div>
        <p className="text-sm font-body font-semibold text-slate-900">
          {isGroup
            ? `Säg hej till ${groupName || "gruppen"}!`
            : `Säg hej till ${otherProfile?.firstName || otherProfile?.displayName || "din vän"}!`}
        </p>
        <p className="text-xs text-slate-500 font-mono mt-1">// conversation.start()</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/50 px-3 py-3 space-y-1">
      {grouped.map((group, gi) => (
        <div key={gi} className="space-y-1">
          <DateSeparator date={group.date} />
          {group.messages.map((m, mi) => {
            const mine = m.senderUid === myUid;
            const prev = group.messages[mi - 1];
            const showAvatar =
              !mine && (!prev || prev.senderUid !== m.senderUid);
            const senderProfile = isGroup
              ? groupProfiles.get(m.senderUid)
              : otherProfile;
            // Show sender name in groups, only on first message of a streak.
            const showSenderName =
              isGroup && !mine && (!prev || prev.senderUid !== m.senderUid);

            return (
              <MessageBubble
                key={m.id}
                message={m}
                mine={mine}
                senderProfile={senderProfile}
                showAvatar={showAvatar || mine}
                showSenderName={showSenderName}
                onImageClick={(img) => setLightboxImage(img)}
              />
            );
          })}
        </div>
      ))}
      {typingActive && (
        <TypingBubble
          label={typingLabel}
          isGroup={isGroup}
          otherProfile={otherProfile}
        />
      )}
      <ImageLightbox
        image={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MessageBubble
   ────────────────────────────────────────────────────────────────── */

function MessageBubble({ message, mine, senderProfile, showAvatar, showSenderName, onImageClick }) {
  const time = formatTime(message.createdAt);
  const bubbleClass = mine
    ? "bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white rounded-2xl rounded-br-md"
    : "bg-white text-slate-900 border border-slate-200 rounded-2xl rounded-bl-md";

  const handleImageClick = (e) => {
    e.preventDefault();
    onImageClick?.({
      url: message.fileUrl,
      name: message.fileName,
      size: message.fileSize,
    });
  };

  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine && (
        <div className="w-7 h-7 shrink-0 mb-0.5">
          {showAvatar && (
            <Avatar
              name={senderProfile?.displayName}
              src={senderProfile?.photoURL}
              size="xs"
            />
          )}
        </div>
      )}
      <div className={cn("max-w-[72%] flex flex-col", mine ? "items-end" : "items-start")}>
        {showSenderName && (
          <span className="text-[10px] text-slate-500 font-mono mb-0.5 px-2">
            {senderProfile?.displayName || "Okänd"}
          </span>
        )}
        {message.type === "image" && message.fileUrl ? (
          // Button (not <a>) so left-click opens our in-app lightbox.
          // Right-click on the inner <img> still gives the browser's
          // native context menu — "Save image as..." works as expected.
          <button
            type="button"
            onClick={handleImageClick}
            className="block rounded-2xl overflow-hidden border border-slate-200 hover:opacity-95 hover:ring-2 hover:ring-[#0052FF]/30 transition-all"
            aria-label={message.fileName ? `Visa bild ${message.fileName}` : "Visa bild"}
          >
            <img
              src={message.fileUrl}
              alt={message.fileName || "Bild"}
              className="max-w-full max-h-56 object-cover block cursor-zoom-in"
              draggable={false}
            />
          </button>
        ) : message.type === "file" && message.fileUrl ? (
          <a
            href={message.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn("px-3 py-2.5 flex items-center gap-2.5 hover:opacity-90 transition", bubbleClass)}
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", mine ? "bg-white/20" : "bg-slate-100")}>
              <FileText className={cn("w-4 h-4", mine ? "text-white" : "text-slate-500")} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono font-medium truncate">{message.fileName}</p>
              <p className={cn("text-[10px] font-mono", mine ? "text-white/70" : "text-slate-500")}>
                {formatBytes(message.fileSize)}
              </p>
            </div>
            <Download className={cn("w-3.5 h-3.5 ml-2 shrink-0", mine ? "text-white/70" : "text-slate-400")} />
          </a>
        ) : (
          <div className={cn("px-3.5 py-2 text-sm font-body leading-snug whitespace-pre-wrap break-words", bubbleClass)}>
            {message.text}
          </div>
        )}
        <span className="text-[10px] text-slate-400 font-mono mt-0.5 px-1">{time}</span>
      </div>
    </div>
  );
}

function TypingBubble({ label, isGroup, otherProfile }) {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="w-7 h-7 shrink-0 mb-0.5">
        {!isGroup && (
          <Avatar
            name={otherProfile?.displayName}
            src={otherProfile?.photoURL}
            size="xs"
          />
        )}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
        </div>
        {isGroup && label && (
          <span className="text-[10px] text-slate-500 font-mono">{label}</span>
        )}
      </div>
    </div>
  );
}

function DateSeparator({ date }) {
  return (
    <div className="flex items-center gap-2 py-2 my-1">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest px-2">
        {formatDateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   MessageInput — textarea + emoji + file + send
   ────────────────────────────────────────────────────────────────── */

function MessageInput({ conversationId, participants }) {
  const { user } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef(null);
  const textareaRef = useRef(null);
  const lastTypingPing = useRef(0);

  // Compute participants for messages that need them. For groups they
  // arrive via prop. For brand-new private chats (conversation doc
  // hasn't loaded yet), derive from the conversationId.
  const effectiveParticipants = useMemo(() => {
    if (Array.isArray(participants) && participants.length > 0) return participants;
    if (typeof conversationId === "string" && conversationId.includes("_")) {
      return conversationId.split("_");
    }
    return null;
  }, [participants, conversationId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !user || !conversationId) return;
    if (!effectiveParticipants) {
      toast.error("Kunde inte hitta chattens deltagare.");
      return;
    }
    setSending(true);
    try {
      await sendTextMessage(conversationId, user.uid, effectiveParticipants, trimmed);
      setText("");
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      console.error("sendTextMessage failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte skicka meddelandet.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    const now = Date.now();
    if (conversationId && user && now - lastTypingPing.current > TYPING_THROTTLE_MS) {
      lastTypingPing.current = now;
      setTyping(conversationId, user.uid);
    }
  };

  useEffect(() => {
    if (text.length === 0 && conversationId && user) {
      clearTyping(conversationId, user.uid);
    }
  }, [text, conversationId, user]);

  const handlePickEmoji = (emoji) => {
    setText((t) => t + emoji);
    setEmojiOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!file || !user || !conversationId || !effectiveParticipants) return;
    setUploading(true);
    setProgress(0);
    try {
      await sendFileMessage(conversationId, user.uid, effectiveParticipants, file, {
        onProgress: setProgress,
      });
    } catch (err) {
      console.error("sendFileMessage failed", err?.code, err?.message);
      toast.error(err.message || "Kunde inte ladda upp filen.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="relative border-t border-slate-200 bg-white">
      {emojiOpen && (
        <div className="absolute bottom-full left-2 mb-2">
          <EmojiPicker onPick={handlePickEmoji} onClose={() => setEmojiOpen(false)} />
        </div>
      )}

      {uploading && (
        <div className="absolute top-0 left-0 right-0">
          <div className="h-0.5 bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5 px-2 py-2">
        <button
          type="button"
          onClick={() => setEmojiOpen((o) => !o)}
          className={cn(
            "p-1.5 rounded-lg transition-colors shrink-0",
            emojiOpen
              ? "text-[#0052FF] bg-blue-50"
              : "text-slate-400 hover:text-[#0052FF] hover:bg-blue-50"
          )}
          aria-label="Emoji"
        >
          <Smile className="w-4 h-4" />
        </button>

        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,application/pdf,application/zip,.doc,.docx,.txt,.xlsx,.csv"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-[#0052FF] hover:bg-blue-50 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Bifoga fil"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Skriv ett meddelande..."
          className="flex-1 resize-none px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 font-body focus-visible:outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20 transition-all max-h-32"
          disabled={sending}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all",
            text.trim() && !sending
              ? "bg-gradient-to-br from-[#0052FF] to-[#4D7CFF] text-white shadow-glow hover:brightness-110 active:scale-95"
              : "bg-slate-100 text-slate-300 cursor-not-allowed"
          )}
          aria-label="Skicka"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

function toJsDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return new Date(ts);
}

function formatTime(ts) {
  const date = toJsDate(ts);
  if (!date) return "";
  return date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (d.getTime() === today.getTime()) return "Idag";
  if (d.getTime() === yesterday.getTime()) return "Igår";
  return d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "long",
    year: today.getFullYear() === d.getFullYear() ? undefined : "numeric",
  });
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / Math.pow(1024, i);
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function groupMessagesByDay(messages) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  for (const m of messages) {
    const d = toJsDate(m.createdAt);
    if (!d) continue;
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (dayKey !== currentDate) {
      currentDate = dayKey;
      currentGroup = { date: d, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(m);
  }
  return groups;
}
