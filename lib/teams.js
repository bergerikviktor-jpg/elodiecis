/**
 * Team operations — group collaboration primitive.
 *
 * Hierarchy:
 *   teams/{teamId}
 *     invitations/{invitedUid}     deterministic id, one pending invite per user
 *
 * Roles:
 *   - ownerUid: single uid, the team creator (transferable)
 *   - adminUids: 0..N admins, can manage members + settings
 *   - members: everyone (owner + admins + regular members)
 *
 * Why deterministic invite ids? They solve the chicken-and-egg of
 * acceptance: a non-member can't update the team to add themselves
 * unless the rule can verify "this user has a real invite". With
 * inviteId == invitedUid, the rule does
 *   exists(/teams/{id}/invitations/{auth.uid})
 * which is cheap and unambiguous.
 */

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
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

const TEAMS = "teams";
const INVITATIONS = "invitations";

/* ──────────────────────────────────────────────────────────────────
   Static catalogues
   ────────────────────────────────────────────────────────────────── */

export const TEAM_ACCENTS = [
  { id: "blue", value: "linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)" },
  { id: "purple", value: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" },
  { id: "green", value: "linear-gradient(135deg, #059669 0%, #22c55e 100%)" },
  { id: "orange", value: "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)" },
  { id: "slate", value: "linear-gradient(135deg, #1e293b 0%, #475569 100%)" },
];

/* ──────────────────────────────────────────────────────────────────
   Create / update
   ────────────────────────────────────────────────────────────────── */

export async function createTeam(
  ownerUid,
  { name, description = "", accentColor = "blue", initialMemberUids = [] }
) {
  if (!ownerUid) throw new Error("Inte inloggad.");
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Teamet måste ha ett namn.");
  if (trimmed.length > 80) throw new Error("Teamnamnet är för långt.");

  // Owner is the only initial member. Co-founders get invited (not auto-added).
  const ref = await addDoc(collection(db, TEAMS), {
    name: trimmed,
    description: (description || "").trim(),
    accentColor,
    ownerUid,
    adminUids: [],
    members: [ownerUid],
    memberCount: 1,
    createdBy: ownerUid,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Send initial invitations (best-effort, individual failures logged).
  for (const uid of initialMemberUids) {
    if (uid === ownerUid) continue;
    try {
      await sendInvitation(ref.id, uid, "member", ownerUid);
    } catch (err) {
      console.warn(`createTeam: invite ${uid} failed`, err?.code, err?.message);
    }
  }

  return ref.id;
}

export async function updateTeamMeta(teamId, updates) {
  const next = {};
  if (typeof updates.name === "string") {
    const trimmed = updates.name.trim();
    if (!trimmed) throw new Error("Teamnamn krävs.");
    if (trimmed.length > 80) throw new Error("Teamnamnet är för långt.");
    next.name = trimmed;
  }
  if (typeof updates.description === "string") {
    next.description = updates.description.trim();
  }
  if (typeof updates.accentColor === "string") {
    next.accentColor = updates.accentColor;
  }
  if (Object.keys(next).length === 0) return;
  next.updatedAt = serverTimestamp();
  await updateDoc(doc(db, TEAMS, teamId), next);
}

/* ──────────────────────────────────────────────────────────────────
   Invitations
   ────────────────────────────────────────────────────────────────── */

/**
 * Send (or refresh) an invitation. Uses deterministic id `invitedUid`,
 * so re-inviting overwrites a prior declined/revoked invite.
 */
export async function sendInvitation(teamId, invitedUid, proposedRole, byUid) {
  if (!teamId || !invitedUid) throw new Error("Saknar parameter.");
  if (invitedUid === byUid) throw new Error("Kan inte bjuda in dig själv.");
  if (!["member", "admin"].includes(proposedRole)) {
    throw new Error("Ogiltig roll.");
  }

  // Don't invite someone who is already a member.
  const teamSnap = await getDoc(doc(db, TEAMS, teamId));
  if (!teamSnap.exists()) throw new Error("Teamet finns inte.");
  const team = teamSnap.data();
  if ((team.members || []).includes(invitedUid)) {
    throw new Error("Personen är redan medlem.");
  }
  // Only the owner can propose admin role.
  if (proposedRole === "admin" && byUid !== team.ownerUid) {
    throw new Error("Endast ägaren kan bjuda in nya admins.");
  }

  await setDoc(doc(db, TEAMS, teamId, INVITATIONS, invitedUid), {
    invitedUid,
    invitedBy: byUid,
    proposedRole,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Accept an invitation. Atomic batch:
 *   1. invitation.status = "accepted"
 *   2. team.members += [me]
 *   3. team.memberCount += 1
 *   4. if proposedRole == "admin": team.adminUids += [me]
 *
 * The rules allow step 2-4 because step 1 happens in the same batch —
 * actually the rules engine evaluates step 2 against current state
 * (invitation still pending), but our rule only requires the
 * invitation to EXIST (and be pending), not yet be accepted.
 */
export async function acceptInvitation(teamId, myUid) {
  const inviteRef = doc(db, TEAMS, teamId, INVITATIONS, myUid);
  const teamRef = doc(db, TEAMS, teamId);

  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error("Inbjudan saknas.");
  const invite = snap.data();
  if (invite.invitedUid !== myUid) throw new Error("Inte din inbjudan.");
  if (invite.status !== "pending") throw new Error("Inbjudan är inte aktiv.");

  const batch = writeBatch(db);
  batch.update(inviteRef, {
    status: "accepted",
    respondedAt: serverTimestamp(),
  });

  const teamUpdates = {
    members: arrayUnion(myUid),
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  };
  if (invite.proposedRole === "admin") {
    teamUpdates.adminUids = arrayUnion(myUid);
  }
  batch.update(teamRef, teamUpdates);

  await batch.commit();
}

export async function declineInvitation(teamId, myUid) {
  await updateDoc(doc(db, TEAMS, teamId, INVITATIONS, myUid), {
    status: "declined",
    respondedAt: serverTimestamp(),
  });
}

export async function revokeInvitation(teamId, invitedUid) {
  await updateDoc(doc(db, TEAMS, teamId, INVITATIONS, invitedUid), {
    status: "revoked",
    respondedAt: serverTimestamp(),
  });
}

/* ──────────────────────────────────────────────────────────────────
   Role management
   ────────────────────────────────────────────────────────────────── */

export async function promoteToAdmin(teamId, uid) {
  await updateDoc(doc(db, TEAMS, teamId), {
    adminUids: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

export async function demoteFromAdmin(teamId, uid) {
  await updateDoc(doc(db, TEAMS, teamId), {
    adminUids: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Atomically transfer ownership. The new owner must already be in
 * `members`. The previous owner becomes a regular member (NOT auto-
 * admin — they can be re-promoted via promoteToAdmin if desired).
 */
export async function transferOwnership(teamId, currentOwnerUid, newOwnerUid) {
  if (currentOwnerUid === newOwnerUid) return;
  const teamRef = doc(db, TEAMS, teamId);
  const snap = await getDoc(teamRef);
  if (!snap.exists()) throw new Error("Teamet finns inte.");
  const team = snap.data();
  if (team.ownerUid !== currentOwnerUid) {
    throw new Error("Endast nuvarande ägare kan överlåta.");
  }
  if (!(team.members || []).includes(newOwnerUid)) {
    throw new Error("Den nya ägaren måste redan vara medlem.");
  }

  await updateDoc(teamRef, {
    ownerUid: newOwnerUid,
    // Remove new owner from admins (they're the owner now, redundant)
    adminUids: arrayRemove(newOwnerUid),
    updatedAt: serverTimestamp(),
  });
}

/* ──────────────────────────────────────────────────────────────────
   Membership
   ────────────────────────────────────────────────────────────────── */

export async function removeMember(teamId, uid) {
  // Caller (owner/admin) removes someone else. We can't remove the owner.
  const teamRef = doc(db, TEAMS, teamId);
  const snap = await getDoc(teamRef);
  if (!snap.exists()) throw new Error("Teamet finns inte.");
  const team = snap.data();
  if (uid === team.ownerUid) {
    throw new Error("Kan inte ta bort ägaren — överlåt först.");
  }
  await updateDoc(teamRef, {
    members: arrayRemove(uid),
    adminUids: arrayRemove(uid),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

export async function leaveTeam(teamId, myUid) {
  const teamRef = doc(db, TEAMS, teamId);
  const snap = await getDoc(teamRef);
  if (!snap.exists()) return;
  const team = snap.data();
  if (team.ownerUid === myUid) {
    throw new Error(
      "Du är ägare — överlåt teamet till någon annan innan du lämnar."
    );
  }
  await updateDoc(teamRef, {
    members: arrayRemove(myUid),
    adminUids: arrayRemove(myUid),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

/* ──────────────────────────────────────────────────────────────────
   Deletion
   ────────────────────────────────────────────────────────────────── */

/**
 * Delete a team and all its subcollections. Owner-only (enforced by
 * rules). Best-effort sub-deletion: per-step failures are logged but
 * we still try the team-doc delete at the end.
 */
export async function deleteTeam(teamId) {
  // 1. Invitations
  try {
    const snap = await getDocs(collection(db, TEAMS, teamId, INVITATIONS));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn("deleteTeam: invitation cleanup failed", err?.code, err?.message);
  }

  // 2. Deals — same pattern. Lazy-import keeps `lib/deals` out of
  //    the auth-side bundle until actually needed.
  try {
    const { deleteAllDealsForTeam } = await import("@/lib/deals");
    await deleteAllDealsForTeam(teamId);
  } catch (err) {
    console.warn("deleteTeam: deal cleanup failed", err?.code, err?.message);
  }

  // 3. Projects (and their nested boardItems/expenses/profitShares/comments).
  try {
    const { deleteAllProjectsForTeam } = await import("@/lib/projects");
    await deleteAllProjectsForTeam(teamId);
  } catch (err) {
    console.warn("deleteTeam: project cleanup failed", err?.code, err?.message);
  }

  // 4. Team doc itself
  await deleteDoc(doc(db, TEAMS, teamId));
}

/* ──────────────────────────────────────────────────────────────────
   Read helpers (one-shot)
   ────────────────────────────────────────────────────────────────── */

/**
 * One-shot: list pending invitations across all teams for a user.
 * Used to render the "you have pending invites" banner.
 */
export async function fetchMyPendingInvitations(myUid) {
  const q = query(
    collectionGroup(db, INVITATIONS),
    where("invitedUid", "==", myUid),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    teamId: d.ref.parent.parent.id,
    ...d.data(),
  }));
}
