"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribe in real-time to a subcollection under `users/{uid}`.
 *
 * @param {string} subPath  Subcollection name (e.g. "folders", "files",
 *                          "notes", "teamMembers").
 * @param {object} options
 * @param {string} options.orderField  Field to sort by — defaults to "createdAt".
 * @param {"asc"|"desc"} options.direction  Sort direction — defaults to "desc".
 *
 * @returns {{ items: Array<object>, loading: boolean, error: Error|null }}
 *
 * State:
 *   - `loading: true`  → first snapshot pending
 *   - `loading: false, items: []` → empty collection
 *   - `loading: false, items: [...]` → data loaded
 *   - `error: Error` → permission denied or other Firestore error
 *
 * The listener auto-cleans on unmount and re-subscribes when the user changes.
 */
export function useUserCollection(
  subPath,
  { orderField = "createdAt", direction = "desc" } = {}
) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const ref = collection(db, "users", user.uid, subPath);
    const q = query(ref, orderBy(orderField, direction));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(`useUserCollection(${subPath}) error:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, subPath, orderField, direction]);

  return { items, loading, error };
}
