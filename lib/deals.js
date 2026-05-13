/**
 * Pipeline / deal operations.
 *
 * Deals live as a subcollection under their owning team:
 *   teams/{teamId}/deals/{dealId}
 *
 * Membership check inherits from the parent team's `members` array —
 * security rules use a get() lookup against the team doc, matching
 * the pattern we use for boards' columns/tasks.
 *
 * Ordering is integer-based on `order` fields. Reordering renumbers
 * the affected stage(s) in a single batch. Fine for typical pipeline
 * sizes (<100 deals per stage); switch to fractional indexing if we
 * ever need 1000s.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TEAMS = "teams";
const DEALS = "deals";

/* ──────────────────────────────────────────────────────────────────
   Static catalogues
   ────────────────────────────────────────────────────────────────── */

export const PRODUCTION_TYPES = [
  { id: "video", label: "Video" },
  { id: "podcast", label: "Podcast" },
  { id: "social", label: "Social Media-kampanj" },
  { id: "photo", label: "Foto" },
  { id: "event", label: "Event" },
];

export function productionTypeLabel(id) {
  return PRODUCTION_TYPES.find((t) => t.id === id)?.label || id;
}

/* ──────────────────────────────────────────────────────────────────
   Create / update / delete
   ────────────────────────────────────────────────────────────────── */

/**
 * Create a deal in the given team. Returns the new deal id.
 *
 * @param {string} teamId
 * @param {string} creatorUid
 * @param {object} input
 * @param {string} input.customerName   required
 * @param {string} input.projectName    required
 * @param {string} input.productionType required (must be in PRODUCTION_TYPES)
 * @param {number} [input.estimatedValue] in SEK
 * @param {Date|null} [input.deadline]
 * @param {string} [input.ownerUid]      defaults to creatorUid
 * @param {string} [input.notes]
 * @param {string} [input.stage]         defaults to "lead"
 * @param {number} [input.order]         defaults to 0 — caller may pass max+1
 */
export async function createDeal(teamId, creatorUid, input) {
  if (!teamId || !creatorUid) throw new Error("Saknar parameter.");
  const customerName = (input.customerName || "").trim();
  const projectName = (input.projectName || "").trim();
  if (!customerName) throw new Error("Kundnamn krävs.");
  if (!projectName) throw new Error("Projektnamn krävs.");
  if (customerName.length > 120) throw new Error("Kundnamnet är för långt.");
  if (projectName.length > 200) throw new Error("Projektnamnet är för långt.");

  if (!PRODUCTION_TYPES.find((t) => t.id === input.productionType)) {
    throw new Error("Välj en produktionstyp.");
  }

  const estimatedValue = Number.isFinite(input.estimatedValue)
    ? Math.max(0, Math.floor(input.estimatedValue))
    : 0;

  const deadlineDate = input.deadline ? new Date(input.deadline) : null;
  const validDeadline =
    deadlineDate && !Number.isNaN(deadlineDate.getTime()) ? deadlineDate : null;

  const payload = {
    customerName,
    projectName,
    productionType: input.productionType,
    estimatedValue,
    deadline: validDeadline,
    ownerUid: input.ownerUid || creatorUid,
    notes: (input.notes || "").trim(),
    stage: input.stage || "lead",
    order: Number.isFinite(input.order) ? input.order : 0,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, TEAMS, teamId, DEALS), payload);
  return ref.id;
}

/**
 * Patch arbitrary fields. Caller sends only what changed.
 */
export async function updateDeal(teamId, dealId, updates) {
  await updateDoc(doc(db, TEAMS, teamId, DEALS, dealId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDeal(teamId, dealId) {
  await deleteDoc(doc(db, TEAMS, teamId, DEALS, dealId));
}

/* ──────────────────────────────────────────────────────────────────
   Drag & drop persistence
   ────────────────────────────────────────────────────────────────── */

/**
 * Renumber all deals within a single stage. Caller provides the deals
 * in their NEW order; we write order=0..N-1 and pin the stage in one
 * batch.
 */
export async function persistStageOrder(teamId, stage, orderedDeals) {
  const batch = writeBatch(db);
  orderedDeals.forEach((d, i) => {
    batch.update(doc(db, TEAMS, teamId, DEALS, d.id), {
      stage,
      order: i,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Move a deal across stages. Renumbers both source and destination
 * stages in a single atomic batch.
 */
export async function persistCrossStageMove(
  teamId,
  { dealId, fromStage, toStage, newSourceDeals, newDestDeals }
) {
  const batch = writeBatch(db);

  // Renumber source stage (the deal we moved is no longer there).
  newSourceDeals.forEach((d, i) => {
    batch.update(doc(db, TEAMS, teamId, DEALS, d.id), {
      order: i,
      updatedAt: serverTimestamp(),
    });
  });

  // Renumber destination stage (includes the moved deal at its new index).
  newDestDeals.forEach((d, i) => {
    batch.update(doc(db, TEAMS, teamId, DEALS, d.id), {
      stage: toStage,
      order: i,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   Cleanup — called by deleteTeam to wipe the deals subcollection
   ────────────────────────────────────────────────────────────────── */

export async function deleteAllDealsForTeam(teamId) {
  const snap = await getDocs(collection(db, TEAMS, teamId, DEALS));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
