/**
 * Film project operations — visual production hub.
 *
 * Hierarchy under each team:
 *   teams/{teamId}/projects/{projectId}
 *     boardItems/{itemId}          Milanote-style positioned items
 *     expenses/{expenseId}         Cost entries (excl. moms)
 *     profitShares/{uid}           One per project member, uid as id
 *     comments/{commentId}         Project + per-board-item comments
 *
 * Membership inherits from the parent team. The `members` array on the
 * project itself is a SUBSET of team.members — only those actively
 * participating get profit shares and visibility on detail pages.
 *
 * VAT model: all stored amounts are excl. moms (Swedish "ex moms").
 * UI may render with 25% VAT applied for display, but no field in
 * Firestore holds the inkl-moms value.
 */

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PROJECT_PHASES } from "@/lib/schema";

const TEAMS = "teams";
const PROJECTS = "projects";
const BOARD_ITEMS = "boardItems";
const EXPENSES = "expenses";
const PROFIT_SHARES = "profitShares";
const COMMENTS = "comments";

/* ──────────────────────────────────────────────────────────────────
   Static catalogues
   ────────────────────────────────────────────────────────────────── */

export const PROJECT_ACCENTS = [
  { id: "blue", value: "linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)" },
  { id: "purple", value: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" },
  { id: "green", value: "linear-gradient(135deg, #059669 0%, #22c55e 100%)" },
  { id: "orange", value: "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)" },
  { id: "slate", value: "linear-gradient(135deg, #1e293b 0%, #475569 100%)" },
];

export const EXPENSE_CATEGORIES = [
  { id: "equipment", label: "Utrustning" },
  { id: "travel", label: "Resa & boende" },
  { id: "talent", label: "Talent & gage" },
  { id: "post", label: "Efterproduktion" },
  { id: "location", label: "Locations & studio" },
  { id: "music", label: "Musik & rättigheter" },
  { id: "other", label: "Övrigt" },
];

export const SWEDISH_VAT_RATE = 0.25; // standardmoms 25%

/* ──────────────────────────────────────────────────────────────────
   Project root
   ────────────────────────────────────────────────────────────────── */

export async function createProject(
  teamId,
  creatorUid,
  {
    title,
    description = "",
    customerName = "",
    productionType = "video",
    coverColor = "blue",
    totalBudget = 0,
    sourceDealId = null,
    initialMemberUids = [],
  }
) {
  if (!teamId || !creatorUid) throw new Error("Saknar parameter.");
  const trimmed = (title || "").trim();
  if (!trimmed) throw new Error("Projektet måste ha en titel.");
  if (trimmed.length > 200) throw new Error("Titeln är för lång.");

  const budget = Number.isFinite(totalBudget)
    ? Math.max(0, Math.floor(totalBudget))
    : 0;

  // Creator is always the first member + project lead.
  const members = Array.from(
    new Set([creatorUid, ...(Array.isArray(initialMemberUids) ? initialMemberUids : [])])
  );

  const ref = await addDoc(
    collection(db, TEAMS, teamId, PROJECTS),
    {
      title: trimmed,
      description: (description || "").trim(),
      customerName: (customerName || "").trim(),
      productionType,
      coverColor,
      coverImage: null,
      sourceDealId,
      members,
      leadUid: creatorUid,
      phase: "pre_production",
      phaseHistory: [{ phase: "pre_production", enteredAt: new Date() }],
      totalBudget: budget,
      totalExpenses: 0,
      status: "active",
      archivedAt: null,
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );

  return ref.id;
}

export async function updateProject(teamId, projectId, updates) {
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Move the project to a new phase. Records the transition in
 * `phaseHistory` for later analytics (avg time per phase, etc).
 */
export async function setProjectPhase(teamId, projectId, newPhase) {
  if (!PROJECT_PHASES.find((p) => p.id === newPhase)) {
    throw new Error("Ogiltig fas.");
  }
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    phase: newPhase,
    // Append the new transition. We let the client compose the entry
    // because Firestore doesn't support array-append with timestamps
    // in a single op.
    phaseHistory: arrayUnion({
      phase: newPhase,
      enteredAt: new Date(),
    }),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Archive — sets status, stamps archivedAt, and locks every profit
 * share so the configuration is frozen as an auditable snapshot.
 * Rules also block writes on subcollections once status == archived.
 */
export async function archiveProject(teamId, projectId) {
  const archiveTs = serverTimestamp();
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    status: "archived",
    archivedAt: archiveTs,
    updatedAt: archiveTs,
  });

  // Lock every existing profit share. Best-effort — if a member is
  // added/edited mid-archive, that's still safe because rules deny
  // further writes once status == archived.
  try {
    const sharesSnap = await getDocs(
      collection(db, TEAMS, teamId, PROJECTS, projectId, PROFIT_SHARES)
    );
    if (!sharesSnap.empty) {
      const batch = writeBatch(db);
      sharesSnap.docs.forEach((d) => {
        batch.update(d.ref, { lockedAt: archiveTs });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn("archiveProject: lock shares failed", err?.code, err?.message);
  }
}

export async function unarchiveProject(teamId, projectId) {
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    status: "active",
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
  // Unlock shares
  try {
    const sharesSnap = await getDocs(
      collection(db, TEAMS, teamId, PROJECTS, projectId, PROFIT_SHARES)
    );
    if (!sharesSnap.empty) {
      const batch = writeBatch(db);
      sharesSnap.docs.forEach((d) => {
        batch.update(d.ref, { lockedAt: null });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn("unarchiveProject: unlock shares failed", err?.code, err?.message);
  }
}

/**
 * Delete project + every subcollection doc. Best-effort per phase.
 */
export async function deleteProjectAndChildren(teamId, projectId) {
  const subcollections = [BOARD_ITEMS, EXPENSES, PROFIT_SHARES, COMMENTS];
  for (const sub of subcollections) {
    try {
      const snap = await getDocs(
        collection(db, TEAMS, teamId, PROJECTS, projectId, sub)
      );
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn(`deleteProject: ${sub} cleanup failed`, err?.code, err?.message);
    }
  }
  await deleteDoc(doc(db, TEAMS, teamId, PROJECTS, projectId));
}

/* ──────────────────────────────────────────────────────────────────
   Member management
   ────────────────────────────────────────────────────────────────── */

/**
 * Add a person to the project. They must already be in the parent
 * team — UI enforces this by picking from team members only.
 */
export async function addProjectMember(teamId, projectId, uid) {
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    members: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function removeProjectMember(teamId, projectId, uid) {
  // Note: doesn't delete the corresponding profit share — that's
  // intentional, the share entry may have historical value (e.g.
  // someone left mid-project but still earned their cut).
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    members: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function setProjectLead(teamId, projectId, newLeadUid) {
  await updateDoc(doc(db, TEAMS, teamId, PROJECTS, projectId), {
    leadUid: newLeadUid,
    updatedAt: serverTimestamp(),
  });
}

/* ──────────────────────────────────────────────────────────────────
   Cascade cleanup — called by deleteTeam
   ────────────────────────────────────────────────────────────────── */

export async function deleteAllProjectsForTeam(teamId) {
  const snap = await getDocs(collection(db, TEAMS, teamId, PROJECTS));
  for (const projectDoc of snap.docs) {
    try {
      await deleteProjectAndChildren(teamId, projectDoc.id);
    } catch (err) {
      console.warn(
        `deleteAllProjectsForTeam: ${projectDoc.id} failed`,
        err?.code,
        err?.message
      );
    }
  }
}
