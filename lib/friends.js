/**
 * Friend / team operations.
 *
 * All Firestore writes go through these helpers so the rules contract
 * and duplicate-prevention live in ONE place — never call addDoc /
 * updateDoc on friendRequests or friendships from a UI component.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const USERS = "users";
const FRIEND_REQUESTS = "friendRequests";
const FRIENDSHIPS = "friendships";

const SEARCH_LIMIT = 10;
const PREFIX_END = ""; // Unicode private-use char that sorts after any normal text

/**
 * Deterministic friendship document ID for a pair of users. Sorting the
 * uids guarantees both members derive the SAME id, so we can never
 * accidentally create two friendship docs for the same pair.
 */
export function friendshipIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

/**
 * Search the global users collection by prefix on multiple fields.
 *
 * Strategy: Firestore has no full-text search, so we maintain lowercase
 * shadow fields (`emailLower`, `displayNameLower`, `firstNameLower`,
 * `lastNameLower`) and run parallel range queries. Results are merged
 * by uid with the current user filtered out.
 *
 * - "Erik"    → matches displayName/firstName/lastName starting with "erik"
 * - "Erik B"  → matches displayName starting with "erik b"
 * - "berg"    → matches lastName starting with "berg"
 * - "@gmail"  → matches email starting with "@gmail"
 *
 * @param {string} rawQuery   The user's input
 * @param {string} currentUid The signed-in user (excluded from results)
 * @returns {Promise<Array<{ id: string, [field: string]: any }>>}
 */
export async function searchUsers(rawQuery, currentUid) {
  const q = (rawQuery || "").trim().toLowerCase();
  if (q.length < 2) return [];

  const usersCol = collection(db, USERS);

  const prefixQuery = (field) =>
    query(
      usersCol,
      where(field, ">=", q),
      where(field, "<", q + PREFIX_END),
      limit(SEARCH_LIMIT)
    );

  // Pick fields based on query shape: emails get email-only, names get the rest.
  const fields = q.includes("@")
    ? ["emailLower"]
    : ["displayNameLower", "firstNameLower", "lastNameLower", "emailLower"];

  const snaps = await Promise.all(
    fields.map((f) => getDocs(prefixQuery(f)).catch(() => null))
  );

  const merged = new Map();
  for (const snap of snaps) {
    if (!snap) continue;
    for (const d of snap.docs) {
      if (d.id === currentUid) continue;
      if (!merged.has(d.id)) merged.set(d.id, { id: d.id, ...d.data() });
    }
  }
  return Array.from(merged.values());
}

/**
 * Look up multiple user profiles by uid. Returns a Map<uid, profile>.
 * Firestore allows up to 30 ids per `in` query, so we chunk.
 */
export async function fetchUserProfiles(uids) {
  const result = new Map();
  if (!uids || uids.length === 0) return result;

  const unique = Array.from(new Set(uids));
  const usersCol = collection(db, USERS);

  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    const snap = await getDocs(query(usersCol, where(documentId(), "in", chunk)));
    snap.forEach((d) => result.set(d.id, { id: d.id, ...d.data() }));
  }
  return result;
}

/**
 * Send a friend request. Throws on:
 *   - sending to self
 *   - already friends
 *   - already a pending request in either direction
 */
export async function sendFriendRequest(fromUid, toUid) {
  if (!fromUid || !toUid) throw new Error("Saknar användare.");
  if (fromUid === toUid) throw new Error("Du kan inte lägga till dig själv.");

  // Already friends? (single-doc get on a deterministic id)
  try {
    const friendshipRef = doc(db, FRIENDSHIPS, friendshipIdFor(fromUid, toUid));
    const friendshipSnap = await getDoc(friendshipRef);
    if (friendshipSnap.exists()) {
      throw new Error("Ni är redan vänner.");
    }
  } catch (err) {
    if (err?.message === "Ni är redan vänner.") throw err;
    console.error("[sendFriendRequest] friendship getDoc failed", err?.code, err?.message);
    throw err;
  }

  // Pending request in either direction? (two list queries)
  const requests = collection(db, FRIEND_REQUESTS);
  let outgoing, incoming;
  try {
    [outgoing, incoming] = await Promise.all([
      getDocs(
        query(
          requests,
          where("fromUid", "==", fromUid),
          where("toUid", "==", toUid),
          where("status", "==", "pending"),
          limit(1)
        )
      ),
      getDocs(
        query(
          requests,
          where("fromUid", "==", toUid),
          where("toUid", "==", fromUid),
          where("status", "==", "pending"),
          limit(1)
        )
      ),
    ]);
  } catch (err) {
    console.error("[sendFriendRequest] friendRequests query failed", err?.code, err?.message);
    throw err;
  }

  if (!outgoing.empty) throw new Error("Förfrågan är redan skickad.");
  if (!incoming.empty) {
    throw new Error("Personen har redan skickat en förfrågan till dig.");
  }

  // Create the request
  try {
    await addDoc(requests, {
      fromUid,
      toUid,
      status: "pending",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[sendFriendRequest] addDoc failed", err?.code, err?.message);
    throw err;
  }
}

/**
 * Accept a pending friend request.
 *
 * Atomically (in a single batch):
 *   1. Mark the request as accepted
 *   2. Create the friendship document
 *
 * Both writes go through the security rules: only the recipient can
 * update the request, and the recipient is in the friendship's `users`
 * array, so the rules pass.
 */
export async function acceptFriendRequest(requestId, currentUid) {
  const reqRef = doc(db, FRIEND_REQUESTS, requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error("Förfrågan hittades inte.");
  const data = snap.data();
  if (data.toUid !== currentUid) {
    throw new Error("Du är inte mottagare av denna förfrågan.");
  }
  if (data.status !== "pending") {
    throw new Error("Förfrågan är inte längre väntande.");
  }

  const friendshipRef = doc(
    db,
    FRIENDSHIPS,
    friendshipIdFor(data.fromUid, data.toUid)
  );

  const batch = writeBatch(db);
  batch.update(reqRef, { status: "accepted" });
  batch.set(friendshipRef, {
    users: [data.fromUid, data.toUid],
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Decline a pending friend request — only the recipient may call this.
 */
export async function declineFriendRequest(requestId, currentUid) {
  const reqRef = doc(db, FRIEND_REQUESTS, requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error("Förfrågan hittades inte.");
  const data = snap.data();
  if (data.toUid !== currentUid) {
    throw new Error("Du är inte mottagare av denna förfrågan.");
  }
  if (data.status !== "pending") {
    throw new Error("Förfrågan är inte längre väntande.");
  }
  await updateDoc(reqRef, { status: "declined" });
}

/**
 * Cancel an outgoing pending request — only the sender may call this.
 */
export async function cancelFriendRequest(requestId, currentUid) {
  const reqRef = doc(db, FRIEND_REQUESTS, requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) return; // already gone — idempotent
  const data = snap.data();
  if (data.fromUid !== currentUid) {
    throw new Error("Du är inte avsändare av denna förfrågan.");
  }
  await deleteDoc(reqRef);
}

/**
 * Remove a friend. Deletes the friendship document — both users lose
 * the connection immediately via realtime listeners.
 */
export async function removeFriend(currentUid, otherUid) {
  if (!currentUid || !otherUid) throw new Error("Saknar användare.");
  const friendshipRef = doc(db, FRIENDSHIPS, friendshipIdFor(currentUid, otherUid));
  await deleteDoc(friendshipRef);
}
