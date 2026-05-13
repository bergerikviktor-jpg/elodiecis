"use client";

/**
 * Realtime-hooks för klient-domänen.
 *
 * Speglar mönstret i useDealsData/useProjectsData — onSnapshot per
 * query, ren state i { data, loading }. Inga effekter eller cache
 * mellan hookar (Firestore SDK gör in-memory caching åt oss).
 */

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
const CLIENTS = "clients";

/* ──────────────────────────────────────────────────────────────────
   Topp-nivå: alla kunder i ett team
   ────────────────────────────────────────────────────────────────── */

/**
 * Realtime-lista över kunderna i ett team.
 *
 * @param {string} teamId
 * @param {object} [opts]
 * @param {boolean} [opts.includeArchived=false]  ta även med archived
 * @param {"createdAt"|"updatedAt"|"companyName"|"clientNumberDigits"} [opts.sortBy="createdAt"]
 * @param {"asc"|"desc"} [opts.direction="desc"]
 */
export function useClients(teamId, opts = {}) {
  const { includeArchived = false, sortBy = "createdAt", direction = "desc" } = opts;
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Vid filtrering på status behöver vi composite-index (status, sortBy).
    // För default-vyn (active only) blir det det här query:t. Vid
    // includeArchived skippar vi where-clauset.
    const base = collection(db, TEAMS, teamId, CLIENTS);
    const q = includeArchived
      ? query(base, orderBy(sortBy, direction))
      : query(base, where("status", "==", "active"), orderBy(sortBy, direction));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useClients error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, includeArchived, sortBy, direction]);

  return { clients, loading };
}

/* ──────────────────────────────────────────────────────────────────
   Detaljvy: en specifik kund
   ────────────────────────────────────────────────────────────────── */

export function useClient(teamId, clientId) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!teamId || !clientId) {
      setClient(null);
      setNotFound(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);

    const ref = doc(db, TEAMS, teamId, CLIENTS, clientId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setClient(null);
          setNotFound(true);
        } else {
          setClient({ id: snap.id, ...snap.data() });
          setNotFound(false);
        }
        setLoading(false);
      },
      (err) => {
        console.error("useClient error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, clientId]);

  return { client, loading, notFound };
}

/* ──────────────────────────────────────────────────────────────────
   Subcollections per kund
   ────────────────────────────────────────────────────────────────── */

function makeSubCollectionHook(subName, defaultSort = ["createdAt", "desc"]) {
  return function useClientSub(teamId, clientId, opts = {}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const sortField = opts.sortBy || defaultSort[0];
    const sortDir = opts.direction || defaultSort[1];

    useEffect(() => {
      if (!teamId || !clientId) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const q = query(
        collection(db, TEAMS, teamId, CLIENTS, clientId, subName),
        orderBy(sortField, sortDir)
      );
      const unsub = onSnapshot(
        q,
        (snap) => {
          setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          console.error(`useClient ${subName} error:`, err?.code, err?.message);
          setLoading(false);
        }
      );
      return () => unsub();
    }, [teamId, clientId, sortField, sortDir]);

    return { items, loading };
  };
}

const _useContacts = makeSubCollectionHook("contacts", ["createdAt", "desc"]);
export function useClientContacts(teamId, clientId, opts) {
  const { items, loading } = _useContacts(teamId, clientId, opts);
  return { contacts: items, loading };
}

const _useActivity = makeSubCollectionHook("activityLogs", ["occurredAt", "desc"]);
export function useClientActivityLogs(teamId, clientId, opts) {
  const { items, loading } = _useActivity(teamId, clientId, opts);
  return { logs: items, loading };
}

const _useInvoices = makeSubCollectionHook("invoices", ["issueDate", "desc"]);
export function useClientInvoices(teamId, clientId, opts) {
  const { items, loading } = _useInvoices(teamId, clientId, opts);
  return { invoices: items, loading };
}

const _useFiles = makeSubCollectionHook("files", ["uploadedAt", "desc"]);
export function useClientFiles(teamId, clientId, opts) {
  const { items, loading } = _useFiles(teamId, clientId, opts);
  return { files: items, loading };
}

const _useAudit = makeSubCollectionHook("auditLog", ["createdAt", "desc"]);
export function useClientAuditLog(teamId, clientId, opts) {
  const { items, loading } = _useAudit(teamId, clientId, opts);
  return { entries: items, loading };
}

/* ──────────────────────────────────────────────────────────────────
   Korskopplingar: deals & projects som referar till kunden
   ────────────────────────────────────────────────────────────────── */

/**
 * Realtime-lista över deals som hör till en specifik kund.
 * Förutsätter att deal-docen har ett `clientId`-fält (sätts av
 * NewDealModal/edit när vi byggt den biten).
 */
export function useClientDeals(teamId, clientId) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !clientId) {
      setDeals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, TEAMS, teamId, "deals"),
      where("clientId", "==", clientId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useClientDeals error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, clientId]);

  return { deals, loading };
}

/**
 * Realtime-lista över projekt kopplade till kunden.
 * Förutsätter `clientId` på project-doc.
 */
export function useClientProjects(teamId, clientId) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId || !clientId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, TEAMS, teamId, "projects"),
      where("clientId", "==", clientId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("useClientProjects error:", err?.code, err?.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [teamId, clientId]);

  return { projects, loading };
}
