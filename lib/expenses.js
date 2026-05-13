/**
 * Expense operations for a film project.
 *
 * Path: teams/{teamId}/projects/{projectId}/expenses/{expenseId}
 *
 * All `amount` values are stored EXCLUSIVE of VAT (Swedish "ex moms").
 * The UI may render with 25% applied as a display helper, but no
 * Firestore field carries the inkl-moms value. Single source of truth.
 *
 * The parent project doc carries a denormalized `totalExpenses` cache,
 * incremented atomically when expenses are added/removed/edited. This
 * makes the finance summary cards an O(1) read instead of a full-
 * subcollection scan.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";

const TEAMS = "teams";
const PROJECTS = "projects";
const EXPENSES = "expenses";

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10 MB

/* ──────────────────────────────────────────────────────────────────
   Receipt upload
   ────────────────────────────────────────────────────────────────── */

/**
 * Upload a receipt (image or PDF) to Storage. Returns the download URL
 * + storage path. Caller saves both on the expense doc so we can
 * preview the file later.
 */
export async function uploadReceipt(teamId, projectId, file, { onProgress } = {}) {
  if (!file) throw new Error("Ingen fil vald.");
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error("Kvittot får max vara 10 MB.");
  }
  const allowed =
    file.type.startsWith("image/") || file.type === "application/pdf";
  if (!allowed) {
    throw new Error("Kvittot måste vara en bild eller PDF.");
  }

  onProgress?.(10);
  const path = `projects/${teamId}/${projectId}/receipts/${Date.now()}-${file.name}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  onProgress?.(70);

  const url = await getDownloadURL(ref);
  onProgress?.(100);

  return {
    url,
    path,
    filename: file.name,
    contentType: file.type,
    size: file.size,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Create / update / delete
   ────────────────────────────────────────────────────────────────── */

/**
 * Add an expense. Transactionally:
 *   1. Creates the expense doc
 *   2. Increments project.totalExpenses
 *
 * `expenseDate` defaults to today if omitted.
 *
 * Returns the new expense id.
 */
export async function createExpense(
  teamId,
  projectId,
  creatorUid,
  {
    description,
    amount,
    phase,
    category = "other",
    expenseDate = null,
    vendorName = "",
    invoiceNumber = "",
    receipt = null, // { url, path, filename, contentType, size } from uploadReceipt
  }
) {
  if (!teamId || !projectId) throw new Error("Saknar projekt-data.");
  const trimmedDesc = (description || "").trim();
  if (!trimmedDesc) throw new Error("Beskrivning krävs.");
  if (trimmedDesc.length > 240) throw new Error("Beskrivningen är för lång.");

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    throw new Error("Beloppet måste vara ett positivt tal.");
  }
  const amountInt = Math.round(amt);

  const expenseDateTs = expenseDate
    ? Timestamp.fromDate(new Date(expenseDate))
    : Timestamp.now();

  // Use a transaction so the project's totalExpenses cache stays in
  // sync with the actual sum. If the project doesn't exist we abort.
  const projectRef = doc(db, TEAMS, teamId, PROJECTS, projectId);
  const expensesCol = collection(projectRef, EXPENSES);

  let newExpenseId;

  await runTransaction(db, async (tx) => {
    const projSnap = await tx.get(projectRef);
    if (!projSnap.exists()) throw new Error("Projektet finns inte.");
    if (projSnap.data().status === "archived") {
      throw new Error("Projektet är arkiverat och låst.");
    }

    const newRef = doc(expensesCol);
    newExpenseId = newRef.id;

    tx.set(newRef, {
      description: trimmedDesc,
      amount: amountInt,
      phase: phase || "pre_production",
      category,
      expenseDate: expenseDateTs,
      vendorName: (vendorName || "").trim(),
      invoiceNumber: (invoiceNumber || "").trim(),
      receiptUrl: receipt?.url || null,
      receiptPath: receipt?.path || null,
      receiptFilename: receipt?.filename || null,
      receiptContentType: receipt?.contentType || null,
      receiptSize: receipt?.size || null,
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.update(projectRef, {
      totalExpenses: increment(amountInt),
      updatedAt: serverTimestamp(),
    });
  });

  return newExpenseId;
}

/**
 * Update an expense. If the amount changed, the project's
 * totalExpenses delta is adjusted atomically.
 */
export async function updateExpense(teamId, projectId, expenseId, updates) {
  const projectRef = doc(db, TEAMS, teamId, PROJECTS, projectId);
  const expRef = doc(projectRef, EXPENSES, expenseId);

  await runTransaction(db, async (tx) => {
    const expSnap = await tx.get(expRef);
    if (!expSnap.exists()) throw new Error("Utgiften finns inte.");
    const projSnap = await tx.get(projectRef);
    if (!projSnap.exists()) throw new Error("Projektet finns inte.");
    if (projSnap.data().status === "archived") {
      throw new Error("Projektet är arkiverat och låst.");
    }

    const oldAmount = expSnap.data().amount || 0;
    const next = { ...updates, updatedAt: serverTimestamp() };

    // Normalize amount + recompute delta if changed.
    let delta = 0;
    if (updates.amount !== undefined) {
      const amt = Number(updates.amount);
      if (!Number.isFinite(amt) || amt < 0) {
        throw new Error("Beloppet måste vara positivt.");
      }
      const amountInt = Math.round(amt);
      next.amount = amountInt;
      delta = amountInt - oldAmount;
    }

    tx.update(expRef, next);
    if (delta !== 0) {
      tx.update(projectRef, {
        totalExpenses: increment(delta),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

export async function deleteExpense(teamId, projectId, expenseId) {
  const projectRef = doc(db, TEAMS, teamId, PROJECTS, projectId);
  const expRef = doc(projectRef, EXPENSES, expenseId);

  await runTransaction(db, async (tx) => {
    const expSnap = await tx.get(expRef);
    if (!expSnap.exists()) return; // already gone — idempotent
    const projSnap = await tx.get(projectRef);
    if (projSnap.exists() && projSnap.data().status === "archived") {
      throw new Error("Projektet är arkiverat och låst.");
    }

    const amt = expSnap.data().amount || 0;
    tx.delete(expRef);
    if (amt > 0 && projSnap.exists()) {
      tx.update(projectRef, {
        totalExpenses: increment(-amt),
        updatedAt: serverTimestamp(),
      });
    }
  });
}

/* ──────────────────────────────────────────────────────────────────
   VAT helpers — display only, never stored
   ────────────────────────────────────────────────────────────────── */

const VAT_RATE = 0.25;

export function withVat(amountExcl) {
  if (!Number.isFinite(amountExcl)) return 0;
  return Math.round(amountExcl * (1 + VAT_RATE));
}

export function applyVatToggle(amountExcl, showInclVat) {
  return showInclVat ? withVat(amountExcl) : amountExcl;
}
