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
 *
 * Client linkage (added i Fas 2c):
 *   - Optional `clientId` på dealen → kopplas till kunder under
 *     `teams/{teamId}/clients/{id}`.
 *   - Vi underhåller `activeDealsCount` på kund-docen via increment()
 *     i samma batch som mutation:erna. "Aktiv" = stage NOT IN
 *     ("won", "lost"). När en deal flyttas mellan aktiva/inaktiva
 *     stages, eller mellan klienter, bumpar/dekrementerar vi
 *     räknarna atomärt.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TEAMS = "teams";
const DEALS = "deals";
const CLIENTS = "clients";

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

/** En deal anses "aktiv" så länge den inte vunnits eller förlorats. */
export function isActiveDealStage(stage) {
  return stage !== "won" && stage !== "lost";
}

/* ──────────────────────────────────────────────────────────────────
   Internal: kund-cache-justering
   ────────────────────────────────────────────────────────────────── */

/**
 * Lägger till en update på client-docens activeDealsCount i en batch.
 * Hopppar om clientId saknas eller delta är 0.
 */
function _bumpClientDealsCount(batch, teamId, clientId, delta) {
  if (!clientId || delta === 0) return;
  batch.update(doc(db, TEAMS, teamId, CLIENTS, clientId), {
    activeDealsCount: increment(delta),
    updatedAt: serverTimestamp(),
  });
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
 * @param {string} [input.clientId]     optional — koppla till kund-doc
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

  const stage = input.stage || "lead";
  const clientId = input.clientId || null;

  const payload = {
    customerName,
    projectName,
    productionType: input.productionType,
    estimatedValue,
    deadline: validDeadline,
    ownerUid: input.ownerUid || creatorUid,
    notes: (input.notes || "").trim(),
    stage,
    order: Number.isFinite(input.order) ? input.order : 0,
    clientId,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = doc(collection(db, TEAMS, teamId, DEALS));
  const batch = writeBatch(db);
  batch.set(ref, payload);
  // Cache-bump: bara om dealen är aktiv (lead/pitch/etc) OCH har klient.
  if (clientId && isActiveDealStage(stage)) {
    _bumpClientDealsCount(batch, teamId, clientId, +1);
  }
  await batch.commit();
  return ref.id;
}

/**
 * Patch arbitrary fields. Caller skickar bara det som ändras.
 *
 * Vid stage- eller clientId-ändring läser vi den befintliga docen
 * först för att kunna justera kund-cache:n korrekt i samma batch.
 * För övriga ändringar är det fortfarande ett enda updateDoc-anrop.
 */
export async function updateDeal(teamId, dealId, updates) {
  const touchesCache = "stage" in updates || "clientId" in updates;
  const ref = doc(db, TEAMS, teamId, DEALS, dealId);

  if (!touchesCache) {
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Fall tillbaka till plain update — låt Firestore felmeddela.
    await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
    return;
  }
  const before = snap.data();

  const oldClientId = before.clientId || null;
  const oldStage = before.stage;
  const oldActive = isActiveDealStage(oldStage);

  const newClientId = "clientId" in updates ? (updates.clientId || null) : oldClientId;
  const newStage = "stage" in updates ? updates.stage : oldStage;
  const newActive = isActiveDealStage(newStage);

  const batch = writeBatch(db);
  batch.update(ref, { ...updates, updatedAt: serverTimestamp() });

  if (oldClientId === newClientId) {
    // Samma klient — kolla bara om aktivitet flippade.
    if (oldClientId && oldActive !== newActive) {
      _bumpClientDealsCount(batch, teamId, oldClientId, newActive ? +1 : -1);
    }
  } else {
    // Klient bytte — flytta räknaren.
    if (oldClientId && oldActive) {
      _bumpClientDealsCount(batch, teamId, oldClientId, -1);
    }
    if (newClientId && newActive) {
      _bumpClientDealsCount(batch, teamId, newClientId, +1);
    }
  }

  await batch.commit();
}

/**
 * Permanent radering. Läser docen först för att kunna dekrementera
 * kund-cachen om dealen var aktiv och hade en klient.
 */
export async function deleteDeal(teamId, dealId) {
  const ref = doc(db, TEAMS, teamId, DEALS, dealId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Inget att städa — bara försök radera (no-op om docen verkligen inte finns).
    await deleteDoc(ref);
    return;
  }
  const data = snap.data();
  const batch = writeBatch(db);
  batch.delete(ref);
  if (data.clientId && isActiveDealStage(data.stage)) {
    _bumpClientDealsCount(batch, teamId, data.clientId, -1);
  }
  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   Drag & drop persistence
   ────────────────────────────────────────────────────────────────── */

/**
 * Renumber all deals within a single stage. Caller provides the deals
 * in their NEW order; we write order=0..N-1 and pin the stage in one
 * batch. Ingen kund-cache-justering — stage förändras inte här.
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
 * stages i en enda atomisk batch.
 *
 * Cache-detalj: om dealen som flyttades har en clientId och korsar
 * gränsen aktiv/inaktiv (lead↔won, t.ex.) bumpar vi även kundens
 * activeDealsCount. Caller behöver inte göra något extra — vi plockar
 * clientId från newDestDeals.
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

  // Kund-cache: bara om dealen har en klient och korsar aktiv/inaktiv.
  const movedDeal = newDestDeals.find((d) => d.id === dealId);
  const movedClientId = movedDeal?.clientId || null;
  if (movedClientId) {
    const wasActive = isActiveDealStage(fromStage);
    const isActive = isActiveDealStage(toStage);
    if (wasActive && !isActive) {
      _bumpClientDealsCount(batch, teamId, movedClientId, -1);
    } else if (!wasActive && isActive) {
      _bumpClientDealsCount(batch, teamId, movedClientId, +1);
    }
  }

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
  // Ingen kund-cache-justering här: deleteTeam förutsätts radera
  // team-noden helt och hållet inkl. clients/. Förekomsten av detta
  // anrop sker bara vid team-cleanup, inte ad-hoc.
}
