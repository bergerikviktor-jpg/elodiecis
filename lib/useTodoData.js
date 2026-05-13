"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Realtime list of boards the current user is a member of.
 * Ordered by `updatedAt` desc so recently-touched boards bubble up.
 */
export function useBoards(myUid) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!myUid) {
      setBoards([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "boards"),
      where("members", "array-contains", myUid),
      orderBy("updatedAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBoards(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useBoards error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [myUid]);

  return { boards, loading };
}

/**
 * Realtime subscription to a single board doc.
 */
export function useBoard(boardId) {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) {
      setBoard(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "boards", boardId),
      (snap) => {
        setBoard(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("useBoard error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [boardId]);

  return { board, loading };
}

/**
 * Realtime list of a board's columns, ordered by `order`.
 */
export function useColumns(boardId) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) {
      setColumns([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "boards", boardId, "columns"),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setColumns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useColumns error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [boardId]);

  return { columns, loading };
}

/**
 * Realtime list of a board's tasks. Returned in createdAt-asc order
 * by default; consumers re-group/re-sort by columnId + order.
 */
export function useTasks(boardId) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "boards", boardId, "tasks"),
      orderBy("order", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useTasks error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [boardId]);

  return { tasks, loading };
}

/**
 * Realtime list of comments under a task, oldest-first.
 */
export function useTaskComments(boardId, taskId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardId || !taskId) {
      setComments([]);
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "boards", boardId, "tasks", taskId, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useTaskComments error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [boardId, taskId]);

  return { comments, loading };
}
