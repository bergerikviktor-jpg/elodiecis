"use client";

import { useEffect, useState } from "react";
import {
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Realtime list of teams I'm a member of, ordered by recent activity.
 */
export function useTeams(myUid) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid) {
      setTeams([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "teams"),
      where("members", "array-contains", myUid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useTeams error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [myUid]);

  return { teams, loading };
}

/**
 * Realtime subscription to a single team doc.
 */
export function useTeam(teamId) {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setTeam(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "teams", teamId),
      (snap) => {
        setTeam(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("useTeam error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId]);

  return { team, loading };
}

/**
 * Realtime list of pending invitations into a specific team. Used on
 * the team detail page (admin view) — anyone in the team can see who
 * has been invited.
 */
export function useTeamInvitations(teamId) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setInvitations([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "teams", teamId, "invitations"),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvitations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useTeamInvitations error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId]);

  return { invitations, loading };
}

/**
 * Realtime list of MY pending invitations across all teams. Drives
 * the "you have N invites" banner on /team.
 *
 * Implemented with a collection-group query — Firestore requires a
 * single-field exemption + a composite index (members + status).
 */
export function useMyPendingInvitations(myUid) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid) {
      setInvitations([]);
      setLoading(false);
      return;
    }
    const q = query(
      collectionGroup(db, "invitations"),
      where("invitedUid", "==", myUid),
      where("status", "==", "pending")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvitations(
          snap.docs.map((d) => ({
            id: d.id,
            teamId: d.ref.parent.parent.id,
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("useMyPendingInvitations error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [myUid]);

  return { invitations, loading };
}
