"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, KanbanSquare, Users, ArrowUpRight } from "lucide-react";

import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import NewBoardModal from "@/components/modals/NewBoardModal";

import { useAuth } from "@/contexts/AuthContext";
import { useBoards } from "@/lib/useTodoData";
import { useUserProfiles } from "@/lib/useChatData";
import { BOARD_BACKGROUNDS } from "@/lib/todo";
import { formatRelativeTime } from "@/lib/utils";

export default function TodoListPage() {
  const { user } = useAuth();
  const { boards, loading } = useBoards(user?.uid);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Header
        title="Uppgiftstavla"
        subtitle={
          loading
            ? "// laddar..."
            : `// ${boards.length} ${boards.length === 1 ? "board" : "boards"}`
        }
        actions={
          <Button icon={Plus} size="md" onClick={() => setCreateOpen(true)}>
            Ny board
          </Button>
        }
      />

      <div className="p-8 animate-fade-in">
        {loading ? (
          <BoardsSkeleton />
        ) : boards.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={KanbanSquare}
              title="Inga boards än"
              description="Skapa din första board för att börja organisera projekt och uppgifter."
              action={
                <Button icon={Plus} onClick={() => setCreateOpen(true)}>
                  Ny board
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} myUid={user?.uid} />
            ))}
          </div>
        )}
      </div>

      <NewBoardModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function BoardCard({ board, myUid }) {
  const bg =
    BOARD_BACKGROUNDS.find((b) => b.id === board.background) ||
    BOARD_BACKGROUNDS[0];

  // Show first few members as avatars on the card.
  const memberUids = board.members || [];
  const { profiles } = useUserProfiles(memberUids);
  const sortedMembers = memberUids
    .map((u) => profiles.get(u))
    .filter(Boolean)
    .slice(0, 4);

  return (
    <Link href={`/todolist/${board.id}`}>
      <Card hover padding="none" className="group overflow-hidden">
        {/* Colored header strip */}
        <div
          className="h-24 relative"
          style={{ background: bg.value }}
          aria-hidden
        >
          <div className="absolute inset-0 bg-black/10" />
          <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Body */}
        <div className="p-5">
          <h3 className="text-base font-body font-bold text-slate-900 group-hover:text-[#0052FF] transition-colors tracking-tight truncate">
            {board.name}
          </h3>
          {board.description && (
            <p className="text-xs text-slate-500 font-mono mt-1 line-clamp-2 leading-relaxed">
              {board.description}
            </p>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-mono">
                {memberUids.length} {memberUids.length === 1 ? "medlem" : "medlemmar"}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {formatRelativeTime(board.updatedAt || board.createdAt)}
            </span>
          </div>

          {sortedMembers.length > 0 && (
            <div className="flex items-center -space-x-1.5 mt-3">
              {sortedMembers.map((p) => (
                <Avatar
                  key={p.id}
                  name={p.displayName}
                  src={p.photoURL}
                  size="xs"
                  className="ring-2 ring-white"
                />
              ))}
              {memberUids.length > sortedMembers.length && (
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-[10px] font-mono font-semibold flex items-center justify-center ring-2 ring-white">
                  +{memberUids.length - sortedMembers.length}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}

function BoardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} padding="none">
          <div className="h-24 bg-slate-200 animate-pulse" />
          <div className="p-5 space-y-3 animate-pulse">
            <div className="h-4 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
          </div>
        </Card>
      ))}
    </div>
  );
}
