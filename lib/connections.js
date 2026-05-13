/**
 * Board connections — arrows linking two board items.
 *
 * Path: teams/{teamId}/projects/{projectId}/connections/{connectionId}
 *
 * Each connection references two board-item ids. Render layer looks
 * them up, draws an SVG arrow between their centers. When an item
 * moves, its connections re-render automatically because they read
 * from the live item array.
 *
 * Lifecycle: if either endpoint is deleted, the connection becomes
 * orphan. Renderer skips orphans; the cleanup is best-effort below.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TEAMS = "teams";
const PROJECTS = "projects";
const CONNECTIONS = "connections";

export async function createConnection(
  teamId,
  projectId,
  creatorUid,
  { fromItemId, toItemId }
) {
  if (!fromItemId || !toItemId) throw new Error("Saknar item-id.");
  if (fromItemId === toItemId) {
    throw new Error("Kan inte koppla ett objekt till sig själv.");
  }

  // Prevent duplicate (same direction) — query first.
  const existing = await getDocs(
    query(
      collection(db, TEAMS, teamId, PROJECTS, projectId, CONNECTIONS),
      where("fromItemId", "==", fromItemId),
      where("toItemId", "==", toItemId)
    )
  );
  if (!existing.empty) {
    // Idempotent — return existing
    return existing.docs[0].id;
  }

  const ref = await addDoc(
    collection(db, TEAMS, teamId, PROJECTS, projectId, CONNECTIONS),
    {
      fromItemId,
      toItemId,
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function deleteConnection(teamId, projectId, connectionId) {
  await deleteDoc(
    doc(db, TEAMS, teamId, PROJECTS, projectId, CONNECTIONS, connectionId)
  );
}

/**
 * Best-effort: remove every connection where the given item is either
 * the from- or to-endpoint. Called when an item is deleted.
 */
export async function deleteConnectionsForItem(teamId, projectId, itemId) {
  const col = collection(db, TEAMS, teamId, PROJECTS, projectId, CONNECTIONS);
  const [fromSnap, toSnap] = await Promise.all([
    getDocs(query(col, where("fromItemId", "==", itemId))),
    getDocs(query(col, where("toItemId", "==", itemId))),
  ]);
  const ids = new Set();
  fromSnap.docs.forEach((d) => ids.add(d.id));
  toSnap.docs.forEach((d) => ids.add(d.id));
  if (ids.size === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.delete(doc(col, id));
  });
  await batch.commit();
}
