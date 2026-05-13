"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/* Curated emoji set — no external dep. Grouped by category for the
   little tab bar at the top. Add more if needed. */
const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    label: "😀",
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
      "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩",
      "😘", "😗", "😙", "😚", "😋", "😛", "😜", "🤪",
      "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨",
      "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
      "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
      "😎", "🤓", "🧐", "😕", "😟", "🙁", "☹️", "😮",
      "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰",
      "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓",
      "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈",
    ],
  },
  {
    id: "gestures",
    label: "👍",
    name: "Gester",
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🤟",
      "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️",
      "👋", "🤚", "🖐️", "✋", "🖖", "👏", "🙌", "👐",
      "🤲", "🤝", "🙏", "💪", "🦾", "✊", "👊", "🤛",
    ],
  },
  {
    id: "hearts",
    label: "❤️",
    name: "Hjärtan",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
      "💘", "💝", "💟", "♥️", "💯", "💢", "💥", "💫",
      "💦", "💨", "🕳️", "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️",
    ],
  },
  {
    id: "objects",
    label: "🎉",
    name: "Objekt",
    emojis: [
      "🎉", "🎊", "🎈", "🎂", "🎁", "🎀", "🎗️", "🏆",
      "🥇", "🥈", "🥉", "⚽", "🏀", "🎮", "🎯", "🎲",
      "🚀", "✈️", "🚗", "🏠", "📱", "💻", "⌨️", "🖥️",
      "🖨️", "📷", "🎥", "📺", "📻", "🎵", "🎶", "🎤",
      "📚", "📖", "📝", "✏️", "🖊️", "💼", "📎", "📌",
      "💡", "🔥", "⭐", "🌟", "✨", "⚡", "☀️", "🌙",
    ],
  },
  {
    id: "food",
    label: "🍕",
    name: "Mat",
    emojis: [
      "🍕", "🍔", "🌭", "🌮", "🌯", "🥙", "🥪", "🍟",
      "🍗", "🥩", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱",
      "🍙", "🍚", "🥐", "🥖", "🍞", "🥨", "🧀", "🥞",
      "🧇", "🍳", "🥚", "🍰", "🎂", "🧁", "🍪", "🍩",
      "🍫", "🍿", "🍦", "🍨", "🍧", "🥤", "☕", "🍵",
      "🍺", "🍷", "🥂", "🍸", "🍹", "🍾", "🥃", "🧃",
    ],
  },
];

export default function EmojiPicker({ onPick, onClose }) {
  const [active, setActive] = useState(EMOJI_CATEGORIES[0].id);
  const category = EMOJI_CATEGORIES.find((c) => c.id === active) || EMOJI_CATEGORIES[0];

  return (
    <div
      className="w-72 rounded-2xl bg-white border border-slate-200 shadow-hover overflow-hidden animate-fade-in"
      role="dialog"
      aria-label="Emoji-väljare"
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
        {EMOJI_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-lg transition-all duration-150",
              active === c.id
                ? "bg-white shadow-sm scale-105"
                : "hover:bg-white/60 opacity-60 hover:opacity-100"
            )}
            title={c.name}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="max-h-56 overflow-y-auto px-2 py-2">
        <div className="grid grid-cols-8 gap-0.5">
          {category.emojis.map((e, i) => (
            <button
              key={`${category.id}-${i}`}
              type="button"
              onClick={() => {
                onPick?.(e);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-blue-50 active:bg-blue-100 transition-colors"
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
