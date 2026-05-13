"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext(undefined);

/**
 * Idempotent: ensure `users/{uid}` exists AND has the searchable fields
 * (firstName/lastName + lowercase shadow fields) used by the friend system.
 *
 * - First-time login → creates the profile with everything.
 * - Existing profile missing the search fields → backfills via merge.
 * - Existing profile already complete → noop.
 *
 * Called fire-and-forget — its rejection is captured at the call site so
 * a Firestore outage never blocks auth.
 */
/**
 * Default preference values for a new account. Existing accounts are
 * backfilled only with whichever of these fields they're missing — we
 * never overwrite a setting the user has already changed.
 */
const DEFAULT_PREFERENCES = {
  // Notifications
  notificationsEnabled: true,
  emailNotifications: true,
  soundEnabled: true,
  chatNotifications: true,
  friendRequestNotifications: true,
  // Privacy
  showOnlineStatus: true,
  allowFriendRequests: true,
  allowMessagesFromNonFriends: false,
  profileVisibility: "friends", // "public" | "friends" | "private"
  privacyMode: false,
  // Appearance
  darkMode: false,
  compactMode: false,
  // Account
  onlineStatus: "online", // "online" | "away" | "invisible"
  accountStatus: "active",
};

async function bootstrapProfile(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  const displayName =
    firebaseUser.displayName ||
    firebaseUser.email?.split("@")[0] ||
    "User";
  const email = firebaseUser.email || "";
  const parts = displayName.trim().split(/\s+/);
  const firstName = parts[0] || "";
  const lastName = parts.slice(1).join(" ");

  const searchable = {
    displayName,
    firstName,
    lastName,
    email,
    displayNameLower: displayName.toLowerCase(),
    firstNameLower: firstName.toLowerCase(),
    lastNameLower: lastName.toLowerCase(),
    emailLower: email.toLowerCase(),
  };

  if (!snap.exists()) {
    // Brand-new profile — write everything.
    await setDoc(ref, {
      uid: firebaseUser.uid,
      ...searchable,
      photoURL: firebaseUser.photoURL || null,
      plan: "free",
      ...DEFAULT_PREFERENCES,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      lastSeen: serverTimestamp(),
    });
    return;
  }

  // Existing profile — backfill INDIVIDUAL missing fields only. Never
  // overwrite a value the user has already set in /settings.
  //
  // Bug history: previously this used a coupled check —
  //   `if (!emailLower || !displayNameLower) overwrite ALL searchable`
  // which meant that a profile created before `emailLower` existed
  // would get its user-set displayName/firstName/lastName CLOBBERED on
  // every page load (bootstrap would re-derive them from
  // firebaseUser.displayName, which is null for email/password users,
  // so it fell back to the email prefix). That's why edits seemed to
  // "disappear after a while".
  const data = snap.data();
  const merge = {};

  // Identity strings — fill in only if missing. Use `== null` so both
  // `undefined` (field never written) and `null` (explicitly cleared)
  // are treated as missing.
  if (data.displayName == null) merge.displayName = displayName;
  if (data.firstName == null) merge.firstName = firstName;
  if (data.lastName == null) merge.lastName = lastName;
  if (data.email == null) merge.email = email;

  // Lowercase shadow fields used by search. These can lag user edits
  // (e.g. emailLower was added after the user's profile was created)
  // — backfill independently so a missing one doesn't drag the others
  // down with it.
  if (data.displayNameLower == null) merge.displayNameLower = (data.displayName || displayName).toLowerCase();
  if (data.firstNameLower == null) merge.firstNameLower = (data.firstName || firstName).toLowerCase();
  if (data.lastNameLower == null) merge.lastNameLower = (data.lastName || lastName).toLowerCase();
  if (data.emailLower == null) merge.emailLower = (data.email || email).toLowerCase();

  if (data.uid == null) merge.uid = firebaseUser.uid;
  if (data.photoURL === undefined) merge.photoURL = firebaseUser.photoURL || null;

  // Only set defaults for preference keys the doc is missing.
  for (const [k, v] of Object.entries(DEFAULT_PREFERENCES)) {
    if (data[k] === undefined) merge[k] = v;
  }

  // Always touch login timestamps on every bootstrap.
  merge.lastLoginAt = serverTimestamp();
  merge.lastSeen = serverTimestamp();

  if (Object.keys(merge).length > 0) {
    await setDoc(ref, merge, { merge: true });
  }
}

/**
 * Map Firebase auth errors to the user-facing messages requested.
 * Throws an Error whose `message` is the friendly string and `code` is preserved.
 */
function mapAuthError(err, mode) {
  const code = err?.code || "";
  if (mode === "signin") {
    if (
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/invalid-credential" ||
      code === "auth/invalid-login-credentials" ||
      code === "auth/invalid-email"
    ) {
      return "Email or password is incorrect";
    }
  }
  if (mode === "signup") {
    if (code === "auth/email-already-in-use") {
      return "User already exists. Please sign in";
    }
  }
  if (mode === "reset") {
    if (code === "auth/invalid-email") return "Ogiltig e-postadress.";
    if (code === "auth/too-many-requests") return "För många försök. Försök igen senare.";
    // Don't reveal user-not-found — Firebase intentionally hides this in
    // newer versions to prevent email enumeration. Caller shows a generic
    // "if the account exists, we've sent a reset email" message regardless.
  }
  return err?.message || "Something went wrong";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Update auth state SYNCHRONOUSLY first — never let a Firestore
      // hiccup block the login flow.
      setUser(firebaseUser || null);
      setLoading(false);

      // Then, fire-and-forget the profile bootstrap. We only create the
      // profile doc once per verified account; failures are logged but
      // do not affect login.
      if (firebaseUser && firebaseUser.emailVerified) {
        bootstrapProfile(firebaseUser).catch((err) => {
          console.error("Failed to bootstrap user profile:", err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Lightweight profile derived from the Firebase user object — no Firestore read.
  const userProfile = user
    ? {
        id: user.uid,
        fullName:
          user.displayName || user.email?.split("@")[0] || "User",
        email: user.email,
      }
    : null;

  const signIn = async (email, password) => {
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const wrapped = new Error(mapAuthError(err, "signin"));
      wrapped.code = err?.code;
      throw wrapped;
    }
    // Block unverified users — sign them straight back out and signal it
    // to the caller via a dedicated error code.
    if (!cred.user.emailVerified) {
      const verifyEmail = cred.user.email;
      await firebaseSignOut(auth);
      const err = new Error("EMAIL_NOT_VERIFIED");
      err.code = "auth/email-not-verified";
      err.email = verifyEmail;
      throw err;
    }
    return cred;
  };

  const signUp = async (email, password) => {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      const wrapped = new Error(mapAuthError(err, "signup"));
      wrapped.code = err?.code;
      throw wrapped;
    }
    // Send the verification email, then immediately sign the user out so
    // they are NOT auto-logged-in. They must verify, then log in manually.
    const newEmail = cred.user.email;
    try {
      await sendEmailVerification(cred.user);
    } finally {
      await firebaseSignOut(auth);
    }
    return { email: newEmail };
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const wrapped = new Error(mapAuthError(err, "reset"));
      wrapped.code = err?.code;
      throw wrapped;
    }
  };

  const signOut = async () => firebaseSignOut(auth);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
