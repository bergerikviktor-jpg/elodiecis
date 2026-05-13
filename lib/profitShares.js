/**
 * Profit-sharing operations + the core financial math.
 *
 * Path: teams/{teamId}/projects/{projectId}/profitShares/{uid}
 *
 * Deterministic id (== uid) gives us:
 *   - Atomic upsert when editing one person's share
 *   - One config per person max (no duplicates)
 *   - Cheap "what's my share?"-reads via getDoc on a known path
 *
 * The Firestore doc only carries CONFIGURATION (mode + percent/fixed).
 * The actual SEK amount is derived live from the project's current
 * netResult — see `computeProfitDistribution` below. This keeps
 * payouts always in sync with the latest expenses without any sync
 * jobs or denormalized counters.
 */

import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const TEAMS = "teams";
const PROJECTS = "projects";
const PROFIT_SHARES = "profitShares";

/* ──────────────────────────────────────────────────────────────────
   Write API
   ────────────────────────────────────────────────────────────────── */

/**
 * Upsert a profit share. Deterministic id (== uid) means re-saving
 * for the same person overwrites the previous config.
 *
 * @param {string} teamId
 * @param {string} projectId
 * @param {string} uid          subject member
 * @param {string} creatorUid   who's setting/updating the share
 * @param {object} input
 * @param {"percent"|"fixed"} input.mode
 * @param {number} [input.percent]      0-100 when mode == "percent"
 * @param {number} [input.fixedAmount]  SEK (excl. moms) when mode == "fixed"
 * @param {string} [input.roleLabel]    display-only, e.g. "Producer"
 */
export async function upsertProfitShare(
  teamId,
  projectId,
  uid,
  creatorUid,
  input
) {
  if (!uid) throw new Error("Saknar användare.");
  if (!["percent", "fixed"].includes(input.mode)) {
    throw new Error("Ogiltigt läge.");
  }

  const payload = {
    uid,
    mode: input.mode,
    roleLabel: (input.roleLabel || "").trim(),
    lockedAt: null,
    updatedAt: serverTimestamp(),
  };

  if (input.mode === "percent") {
    const pct = Number(input.percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      throw new Error("Procent måste vara 0–100.");
    }
    payload.percent = pct;
    payload.fixedAmount = null;
  } else {
    const fa = Number(input.fixedAmount);
    if (!Number.isFinite(fa) || fa < 0) {
      throw new Error("Fast belopp måste vara positivt.");
    }
    payload.fixedAmount = Math.round(fa);
    payload.percent = null;
  }

  // setDoc + merge so we preserve createdBy/createdAt across edits.
  await setDoc(
    doc(db, TEAMS, teamId, PROJECTS, projectId, PROFIT_SHARES, uid),
    {
      ...payload,
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeProfitShare(teamId, projectId, uid) {
  await deleteDoc(
    doc(db, TEAMS, teamId, PROJECTS, projectId, PROFIT_SHARES, uid)
  );
}

/* ──────────────────────────────────────────────────────────────────
   Math — the single source of truth for "what does each person get?"
   ────────────────────────────────────────────────────────────────── */

/**
 * Compute the distribution given a snapshot of project finances +
 * share configurations. Pure function — no Firestore reads, no async.
 * The realtime UI calls this with the latest values from listeners,
 * so the result is always live.
 *
 * Algorithm (matches the design doc):
 *   1. netResult       = totalBudget − totalExpenses  (can be negative)
 *   2. totalFixed      = sum of fixedAmount across mode=fixed
 *   3. remainingPool   = max(0, netResult − totalFixed)
 *   4. For each fixed share:    computedAmount = fixedAmount
 *      For each percent share:  computedAmount = remainingPool × pct/100
 *   5. Company keeps  remainingPool × (1 − sum(pct)/100)
 *
 * @param {object} args
 * @param {number} args.totalBudget       SEK ex moms
 * @param {number} args.totalExpenses     SEK ex moms
 * @param {Array<{uid, mode, percent?, fixedAmount?, roleLabel?, lockedAt?}>} args.shares
 *
 * @returns {{
 *   netResult: number,
 *   totalFixed: number,
 *   remainingPool: number,
 *   totalPercent: number,
 *   unallocatedToCompany: number,
 *   warnings: { overPercent: boolean, fixedExceedsNet: boolean, negativeNet: boolean },
 *   allocations: Array<{ uid, mode, computedAmount, percent?, fixedAmount?, roleLabel? }>,
 * }}
 */
export function computeProfitDistribution({
  totalBudget = 0,
  totalExpenses = 0,
  shares = [],
}) {
  const safeBudget = Number.isFinite(totalBudget) ? totalBudget : 0;
  const safeExpenses = Number.isFinite(totalExpenses) ? totalExpenses : 0;
  const netResult = safeBudget - safeExpenses;

  // Step 2: sum fixed allocations
  const fixedShares = shares.filter((s) => s.mode === "fixed");
  const totalFixed = fixedShares.reduce(
    (sum, s) => sum + (Number(s.fixedAmount) || 0),
    0
  );

  // Step 3: remaining pool for percent allocations (never negative)
  const remainingPool = Math.max(0, netResult - totalFixed);

  // Step 4: per-share computation
  const percentShares = shares.filter((s) => s.mode === "percent");
  const totalPercent = percentShares.reduce(
    (sum, s) => sum + (Number(s.percent) || 0),
    0
  );

  const allocations = shares.map((s) => {
    let computedAmount;
    if (s.mode === "fixed") {
      computedAmount = Math.round(Number(s.fixedAmount) || 0);
    } else {
      const pct = Number(s.percent) || 0;
      computedAmount = Math.round(remainingPool * (pct / 100));
    }
    return {
      uid: s.uid,
      mode: s.mode,
      percent: s.percent ?? null,
      fixedAmount: s.fixedAmount ?? null,
      roleLabel: s.roleLabel || "",
      lockedAt: s.lockedAt || null,
      computedAmount,
    };
  });

  // Step 5: company remainder
  const unallocatedToCompany = Math.round(
    remainingPool * (1 - Math.min(totalPercent, 100) / 100)
  );

  return {
    netResult,
    totalFixed,
    remainingPool,
    totalPercent,
    unallocatedToCompany,
    warnings: {
      overPercent: totalPercent > 100,
      fixedExceedsNet: totalFixed > netResult && netResult > 0,
      negativeNet: netResult < 0,
    },
    allocations,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Formatting helpers
   ────────────────────────────────────────────────────────────────── */

/**
 * Format SEK as "12 500 kr" or "−5 000 kr" with grouping.
 */
export function formatSEK(amount, { showSign = false } = {}) {
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(Math.round(amount));
  const formatted = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(abs);
  const sign = amount < 0 ? "−" : showSign && amount > 0 ? "+" : "";
  return `${sign}${formatted} kr`;
}

/**
 * Apply Swedish 25% VAT for display. Storage values are always excl.
 */
export function withVAT(amountExcl) {
  if (!Number.isFinite(amountExcl)) return 0;
  return Math.round(amountExcl * 1.25);
}
