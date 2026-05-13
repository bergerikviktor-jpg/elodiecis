"use client";

import { useEffect, useRef } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

const HEARTBEAT_MS = 30_000;
const IDLE_MS = 5 * 60 * 1000;
const ONLINE_WINDOW_MS = 60_000;

/**
 * 3-state presence with idle detection.
 *
 * STATES:
 *   - "online"  → user is active in the tab (recent input)
 *   - "away"    → tab visible, but no input for IDLE_MS
 *   - "offline" → computed by reader if lastSeen is stale (> ONLINE_WINDOW_MS)
 *
 * The hook does two things:
 *
 *   1. Listens to user input (mouse / keyboard / scroll / touch) across
 *      the document. Each event resets the "last activity" stamp. If we
 *      cross the idle threshold, the next heartbeat flips presenceState
 *      to "away".
 *   2. Writes a heartbeat (serverTimestamp lastSeen + current state) to
 *      Firestore every HEARTBEAT_MS while the tab is visible. Reads from
 *      the user doc consume both fields to decide what to show.
 *
 * On `beforeunload` we attempt a final "offline" write — best-effort
 * since Firestore writes can't be made synchronous and the tab may
 * close before it lands. The real offline signal is stale lastSeen.
 */
export function usePresence({
  heartbeatMs = HEARTBEAT_MS,
  idleMs = IDLE_MS,
} = {}) {
  const { user } = useAuth();
  const lastActivity = useRef(Date.now());
  const wasIdle = useRef(false);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    let stopped = false;

    // ── activity tracking ───────────────────────────────────────
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];

    const onActivity = () => {
      lastActivity.current = Date.now();
      // If we previously crossed into idle, trigger an immediate beat
      // so other clients see the "online" flip without waiting up to
      // 30s for the next heartbeat.
      if (wasIdle.current) {
        wasIdle.current = false;
        beat();
      }
    };
    events.forEach((e) =>
      document.addEventListener(e, onActivity, { passive: true })
    );

    // ── heartbeat ───────────────────────────────────────────────
    const beat = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible") return;

      const idle = Date.now() - lastActivity.current > idleMs;
      wasIdle.current = idle;

      try {
        await updateDoc(ref, {
          lastSeen: serverTimestamp(),
          presenceState: idle ? "away" : "online",
        });
      } catch (err) {
        console.warn("presence heartbeat failed:", err?.code || err?.message);
      }
    };

    beat();
    const id = setInterval(beat, heartbeatMs);

    // Visibility — fresh beat when user tabs back in.
    const onVis = () => {
      if (document.visibilityState === "visible") {
        lastActivity.current = Date.now();
        beat();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // Best-effort offline on tab close.
    const onUnload = () => {
      // Fire and forget — can't await on beforeunload anyway.
      updateDoc(ref, {
        presenceState: "offline",
        lastSeen: serverTimestamp(),
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      stopped = true;
      clearInterval(id);
      events.forEach((e) => document.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [user, heartbeatMs, idleMs]);
}

/**
 * Classify a profile's presence into one of: online / away / offline.
 * Accepts the full profile object (needs both `lastSeen` and
 * `presenceState`). Returns label, state, and a hex dot color.
 */
export function presenceLabel(profile, { onlineWindowMs = ONLINE_WINDOW_MS } = {}) {
  const lastSeen = profile?.lastSeen;
  if (!lastSeen) {
    return { state: "offline", label: "Offline", dotColor: "#cbd5e1" };
  }
  const date = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
  const diff = Date.now() - date.getTime();

  // Stale heartbeat → offline regardless of stored state. This catches
  // tab-closes / crashes that never wrote `offline`.
  if (diff > onlineWindowMs) {
    return {
      state: "offline",
      label: lastSeenLabel(diff),
      dotColor: "#cbd5e1",
    };
  }

  if (profile.presenceState === "away") {
    return { state: "away", label: "Borta", dotColor: "#f59e0b" };
  }
  if (profile.presenceState === "offline") {
    return { state: "offline", label: "Offline", dotColor: "#cbd5e1" };
  }
  return { state: "online", label: "Aktiv nu", dotColor: "#22c55e" };
}

function lastSeenLabel(diffMs) {
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Senast aktiv ${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Senast aktiv ${hours} tim sedan`;
  const days = Math.floor(hours / 24);
  return `Senast aktiv ${days} dag${days === 1 ? "" : "ar"} sedan`;
}
