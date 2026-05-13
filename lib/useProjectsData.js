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

const TEAMS = "teams";
const PROJECTS = "projects";

/**
 * Realtime list of projects in a team. By default returns active
 * projects only — archived ones live on /projects/archive (a future
 * page) but can be opted into via `includeArchived: true`.
 */
export function useProjects(teamId, { includeArchived = false } = {}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const base = collection(db, TEAMS, teamId, PROJECTS);
    const q = includeArchived
      ? query(base, orderBy("updatedAt", "desc"))
      : query(
          base,
          where("status", "==", "active"),
          orderBy("updatedAt", "desc")
        );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useProjects error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, includeArchived]);

  return { projects, loading };
}

export function useProject(teamId, projectId) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !projectId) {
      setProject(null);
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, TEAMS, teamId, PROJECTS, projectId),
      (snap) => {
        setProject(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("useProject error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, projectId]);

  return { project, loading };
}

/**
 * Realtime list of expenses for a project. Ordered by expenseDate
 * desc so the most recent show up first.
 */
export function useProjectExpenses(teamId, projectId) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !projectId) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, TEAMS, teamId, PROJECTS, projectId, "expenses"),
      orderBy("expenseDate", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useProjectExpenses error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, projectId]);

  return { expenses, loading };
}

/**
 * Realtime list of board items for a project. Ordered by z-index
 * ascending so the renderer can paint in that order (highest on top).
 */
export function useProjectBoardItems(teamId, projectId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, TEAMS, teamId, PROJECTS, projectId, "boardItems"),
      orderBy("z", "asc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useProjectBoardItems error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, projectId]);

  return { items, loading };
}

/**
 * Realtime list of connections (arrows) for a project. Each entry
 * references two boardItem ids — the renderer resolves them to SVG
 * lines between the items' centers.
 */
export function useProjectConnections(teamId, projectId) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !projectId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, TEAMS, teamId, PROJECTS, projectId, "connections"),
      (snap) => {
        setConnections(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useProjectConnections error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, projectId]);

  return { connections, loading };
}

/**
 * Realtime list of profit-share configurations for a project.
 * One doc per project member (uid as doc id).
 */
export function useProjectProfitShares(teamId, projectId) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !projectId) {
      setShares([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, TEAMS, teamId, PROJECTS, projectId, "profitShares"),
      (snap) => {
        setShares(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(
          "useProjectProfitShares error:",
          err?.code,
          err?.message
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, projectId]);

  return { shares, loading };
}
