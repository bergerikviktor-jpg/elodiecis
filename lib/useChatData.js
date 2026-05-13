"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { fetchUserProfiles } from "@/lib/friends";

/* ──────────────────────────────────────────────────────────────────
   useConversations — realtime list of every conversation I'm in,
   ordered by lastMessageAt desc. Used by the /messages page, the
   sidebar unread badge, and as the source of truth for the chat
   docking system.
   ────────────────────────────────────────────────────────────────── */

export function useConversations(myUid) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", myUid),
      orderBy("lastMessageAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useConversations error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [myUid]);

  return { conversations, loading };
}

/* ──────────────────────────────────────────────────────────────────
   useConversation — realtime subscription to a SINGLE conversation
   doc by id. Returns the doc data including typing + unreadCounts.
   ────────────────────────────────────────────────────────────────── */

export function useConversation(convId) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!convId) {
      setConversation(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "conversations", convId),
      (snap) => {
        setConversation(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("useConversation error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [convId]);

  return { conversation, loading };
}

/* ──────────────────────────────────────────────────────────────────
   useMessages — realtime subscription to the last `limit` messages
   in a conversation, ordered chronologically ascending so the UI can
   just render top-to-bottom.
   ────────────────────────────────────────────────────────────────── */

export function useMessages(convId, myUid, { max = 100 } = {}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!convId || !myUid) {
      setMessages([]);
      setLoading(false);
      return;
    }
    // The where("participants", "array-contains", myUid) clause is
    // redundant in theory (every message in a conv I'm part of will
    // have me as a participant), but it lets Firestore validate the
    // list query against the per-message security rule which checks
    // `request.auth.uid in resource.data.participants`.
    const q = query(
      collection(db, "conversations", convId, "messages"),
      where("participants", "array-contains", myUid),
      orderBy("createdAt", "asc"),
      limit(max)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useMessages error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [convId, myUid, max]);

  return { messages, loading };
}

/* ──────────────────────────────────────────────────────────────────
   useUserDoc — realtime subscription to a single user's profile doc.
   Used by chat popups to track the OTHER party's displayName, photo,
   and presence (lastSeen).
   ────────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────────
   useUserProfiles — fetch profiles for a list of uids (one-shot,
   re-fetched when the uid list grows). Returns a Map<uid, profile>.

   Used by group chat popups + the conversation list to show display
   names + avatars for everyone the user might appear next to.
   Profiles aren't realtime here (would mean N onSnapshots); they're
   refreshed every time the uid list changes, which is enough for
   typical session activity.
   ────────────────────────────────────────────────────────────────── */

export function useUserProfiles(uids) {
  const [profiles, setProfiles] = useState(new Map());

  // Stable key — sorted uid list joined. Lets useEffect re-fetch only
  // when the actual *set* of ids changes, not on every render.
  const key = useMemo(() => (uids || []).slice().sort().join(","), [uids]);

  useEffect(() => {
    if (!uids || uids.length === 0) return;
    const missing = uids.filter((u) => !profiles.has(u));
    if (missing.length === 0) return;
    let cancelled = false;
    fetchUserProfiles(missing)
      .then((m) => {
        if (cancelled) return;
        setProfiles((prev) => {
          const next = new Map(prev);
          m.forEach((v, k) => next.set(k, v));
          return next;
        });
      })
      .catch((err) => console.error("useUserProfiles error:", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { profiles };
}

export function useUserDoc(uid) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("useUserDoc error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  return { profile, loading };
}
