"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Realtime list of every deal in a team. Returned in (stage, order)-asc
 * sort by the client — Firestore returns them in `order` ascending but
 * we re-group by stage for the kanban consumer.
 */
export function useDeals(teamId) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setDeals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, "teams", teamId, "deals"),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useDeals error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId]);

  return { deals, loading };
}
