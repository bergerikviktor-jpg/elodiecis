/**
 * Account / profile mutations.
 *
 * All security-sensitive operations (password change, account delete)
 * reauthenticate first, since Firebase requires a recent credential
 * for those calls. UI components should never call the underlying
 * firebase/auth methods directly — go through these helpers so the
 * Firestore side-effects (lastPasswordUpdate, etc.) stay in sync.
 */

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

const USERS = "users";
const FRIEND_REQUESTS = "friendRequests";
const FRIENDSHIPS = "friendships";

/* ── Reauthentication ──────────────────────────────────────────── */

/**
 * Verify the user's current password by re-issuing a credential. Throws
 * a user-friendly error if the password is wrong or the user is missing.
 */
export async function reauthenticate(currentPassword) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error("Inte inloggad.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (err) {
    if (
      err?.code === "auth/wrong-password" ||
      err?.code === "auth/invalid-credential" ||
      err?.code === "auth/invalid-login-credentials"
    ) {
      const wrapped = new Error("Felaktigt nuvarande lösenord.");
      wrapped.code = err.code;
      throw wrapped;
    }
    throw err;
  }
}

/* ── Password ──────────────────────────────────────────────────── */

/**
 * Change the signed-in user's password after reauthentication.
 * Records `lastPasswordUpdate` in their profile doc.
 */
export async function changeUserPassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inte inloggad.");
  await reauthenticate(currentPassword);
  await updatePassword(user, newPassword);
  // Best-effort — failure here doesn't undo the password change.
  try {
    await updateDoc(doc(db, USERS, user.uid), {
      lastPasswordUpdate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("Could not record lastPasswordUpdate:", err);
  }
}

/* ── Profile ───────────────────────────────────────────────────── */

/**
 * Update firstName / lastName. displayName + lowercase shadow fields
 * are derived automatically — callers must NEVER pass displayName.
 */
export async function updateProfileNames(uid, { firstName, lastName }) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  const displayName = [first, last].filter(Boolean).join(" ") || first || "User";
  await updateDoc(doc(db, USERS, uid), {
    firstName: first,
    lastName: last,
    displayName,
    firstNameLower: first.toLowerCase(),
    lastNameLower: last.toLowerCase(),
    displayNameLower: displayName.toLowerCase(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update arbitrary preference toggles (notifications, privacy, appearance).
 * Caller passes only the fields they want to change.
 */
export async function updatePreferences(uid, prefs) {
  await updateDoc(doc(db, USERS, uid), {
    ...prefs,
    updatedAt: serverTimestamp(),
  });
}

/* ── Avatar ────────────────────────────────────────────────────── */

/**
 * Upload an avatar image to Firebase Storage and store the URL on the
 * user's profile doc. Old avatar files remain in storage as orphans —
 * acceptable trade-off (cleanup would require a Cloud Function).
 *
 * @param {string} uid
 * @param {File} file
 * @param {(progress: number) => void} [onProgress]  0–100
 */
export async function uploadAvatar(uid, file, onProgress) {
  if (!file) throw new Error("Ingen fil vald.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Filen måste vara en bild.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Filen får max vara 5 MB.");
  }

  const ref = storageRef(storage, `avatars/${uid}/${Date.now()}-${file.name}`);
  // uploadBytes is simpler than uploadBytesResumable but no progress.
  // For typical avatar sizes (<1 MB) the upload is fast enough.
  onProgress?.(10);
  await uploadBytes(ref, file);
  onProgress?.(70);

  const url = await getDownloadURL(ref);
  onProgress?.(85);

  await updateDoc(doc(db, USERS, uid), {
    photoURL: url,
    updatedAt: serverTimestamp(),
  });
  onProgress?.(100);

  return url;
}

/**
 * Clear the user's photoURL. Old image stays in Storage.
 */
export async function removeAvatar(uid) {
  await updateDoc(doc(db, USERS, uid), {
    photoURL: null,
    updatedAt: serverTimestamp(),
  });
}

/* ── Account deletion ──────────────────────────────────────────── */

/**
 * Delete every Firestore document the user owns or participates in.
 *
 * MUST run BEFORE `deleteUser(authUser)` — once Firebase Auth removes
 * the user, the security token is invalidated immediately and Firestore
 * writes will fail with permission-denied.
 *
 * Best-effort: individual sub-deletes that fail are logged but don't
 * abort the whole flow. The Auth deletion always proceeds afterwards.
 */
export async function removeAllUserData(uid) {
  // 1. Owner-only subcollections.
  const subcollections = ["folders", "files", "notes", "teamMembers"];
  for (const sub of subcollections) {
    try {
      const snap = await getDocs(collection(db, USERS, uid, sub));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn(`Could not clear users/${uid}/${sub}:`, err);
    }
  }

  // 2. Friend requests in either direction.
  try {
    const requestsCol = collection(db, FRIEND_REQUESTS);
    const [out, inc] = await Promise.all([
      getDocs(query(requestsCol, where("fromUid", "==", uid))),
      getDocs(query(requestsCol, where("toUid", "==", uid))),
    ]);
    const batch = writeBatch(db);
    out.docs.forEach((d) => batch.delete(d.ref));
    inc.docs.forEach((d) => batch.delete(d.ref));
    if (out.size + inc.size > 0) await batch.commit();
  } catch (err) {
    console.warn("Could not clear friendRequests:", err);
  }

  // 3. Friendships involving this user.
  try {
    const snap = await getDocs(
      query(collection(db, FRIENDSHIPS), where("users", "array-contains", uid))
    );
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn("Could not clear friendships:", err);
  }

  // 4. The profile doc itself.
  try {
    await deleteDoc(doc(db, USERS, uid));
  } catch (err) {
    console.warn("Could not delete user profile doc:", err);
  }
}

/**
 * Permanently delete the account: reauthenticates, wipes Firestore data,
 * then deletes the Firebase Auth user. The user is signed out as a
 * side-effect of the auth deletion — caller should redirect to /login.
 */
export async function deleteAccount(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inte inloggad.");
  await reauthenticate(currentPassword);
  await removeAllUserData(user.uid);
  await deleteUser(user);
}
