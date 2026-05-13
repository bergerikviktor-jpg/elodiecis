/**
 * To-do / kanban board operations.
 *
 * Hierarchy:
 *   boards/{boardId}
 *     columns/{columnId}
 *     tasks/{taskId}
 *       comments/{commentId}
 *
 * Ordering is integer-based on `order` fields. Reordering renumbers
 * the affected column (or boards) — fine for typical board sizes
 * (<100 items). For larger boards, switch to fractional indexing.
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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const BOARDS = "boards";
const COLUMNS = "columns";
const TASKS = "tasks";
const COMMENTS = "comments";

/* ──────────────────────────────────────────────────────────────────
   Static catalogues
   ────────────────────────────────────────────────────────────────── */

// Media/byrå-anpassade etiketter. IDs är historiskt namngivna efter de
// gamla utvecklar-etiketterna (priority/bug/design/backend/frontend) —
// vi behåller dem för att inte spöa befintliga task-dokument som lagrar
// label-id:n. Det användaren ser är `name` + `description`.
export const LABEL_CATALOG = [
  {
    id: "priority",
    name: "Brådskande / Kund-prio",
    description: "Saker som påverkar kundrelationen direkt.",
    color: "#ef4444",
  },
  {
    id: "bug",
    name: "Feedback / Justering",
    description: "Saker som kunden vill ändra på.",
    color: "#f59e0b",
  },
  {
    id: "design",
    name: "Skapande / Form",
    description: "Det visuella och det kreativa arbetet.",
    color: "#a855f7",
  },
  {
    id: "backend",
    name: "Strategi / Planering",
    description: "Strategiska beslut och internt pappersarbete.",
    color: "#0052FF",
  },
  {
    id: "frontend",
    name: "Leverans / Presentation",
    description: "Slutprodukten som visas upp för kund.",
    color: "#22c55e",
  },
];

export const BOARD_BACKGROUNDS = [
  { id: "blue", value: "linear-gradient(135deg, #0052FF 0%, #4D7CFF 100%)" },
  { id: "purple", value: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" },
  { id: "green", value: "linear-gradient(135deg, #059669 0%, #22c55e 100%)" },
  { id: "orange", value: "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)" },
  { id: "slate", value: "linear-gradient(135deg, #1e293b 0%, #475569 100%)" },
];

/* ──────────────────────────────────────────────────────────────────
   Boards
   ────────────────────────────────────────────────────────────────── */

export async function createBoard(myUid, { name, description = "", background = "blue" }) {
  if (!myUid) throw new Error("Inte inloggad.");
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Boarden måste ha ett namn.");
  if (trimmed.length > 100) throw new Error("Boardnamnet är för långt.");

  const ref = await addDoc(collection(db, BOARDS), {
    name: trimmed,
    description: (description || "").trim(),
    createdBy: myUid,
    members: [myUid],
    visibility: "private",
    background,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Seed with three default columns so the board isn't empty on first open.
  const defaults = [
    { name: "Att göra", order: 0 },
    { name: "Pågående", order: 1 },
    { name: "Klart", order: 2 },
  ];
  const batch = writeBatch(db);
  for (const c of defaults) {
    const colRef = doc(collection(db, BOARDS, ref.id, COLUMNS));
    batch.set(colRef, { ...c, createdAt: serverTimestamp() });
  }
  await batch.commit();

  return ref.id;
}

export async function updateBoardName(boardId, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Boardnamn krävs.");
  if (trimmed.length > 100) throw new Error("Boardnamnet är för långt.");
  await updateDoc(doc(db, BOARDS, boardId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}

export async function updateBoardBackground(boardId, background) {
  await updateDoc(doc(db, BOARDS, boardId), {
    background,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete an entire board and every doc beneath it. Should only be
 * callable by `createdBy` (enforced by rules).
 *
 * Best-effort per step: each phase is wrapped so a partial failure
 * (e.g. one batch hitting a rule glitch) doesn't abort the entire
 * cleanup. The board doc itself is the LAST thing to go, and we
 * surface its result so the UI knows whether the board is truly gone.
 */
export async function deleteBoardAndChildren(boardId) {
  // 1. Delete every task's comments first.
  let tasksSnap;
  try {
    tasksSnap = await getDocs(collection(db, BOARDS, boardId, TASKS));
  } catch (err) {
    console.warn("deleteBoard: list tasks failed", err?.code, err?.message);
    tasksSnap = null;
  }

  if (tasksSnap) {
    for (const taskDoc of tasksSnap.docs) {
      try {
        const cmts = await getDocs(
          collection(db, BOARDS, boardId, TASKS, taskDoc.id, COMMENTS)
        );
        if (!cmts.empty) {
          const batch = writeBatch(db);
          cmts.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn(
          `deleteBoard: comments for ${taskDoc.id} failed`,
          err?.code,
          err?.message
        );
      }
    }

    // 2. Tasks themselves.
    if (!tasksSnap.empty) {
      try {
        const batch = writeBatch(db);
        tasksSnap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      } catch (err) {
        console.warn("deleteBoard: delete tasks failed", err?.code, err?.message);
      }
    }
  }

  // 3. Columns.
  try {
    const colsSnap = await getDocs(collection(db, BOARDS, boardId, COLUMNS));
    if (!colsSnap.empty) {
      const batch = writeBatch(db);
      colsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn("deleteBoard: delete columns failed", err?.code, err?.message);
  }

  // 4. The board itself — this is the one that MUST succeed for the
  // UX to make sense. Let it throw so the modal surfaces a clear error.
  await deleteDoc(doc(db, BOARDS, boardId));
}

export async function addBoardMembers(boardId, uids) {
  if (!Array.isArray(uids) || uids.length === 0) return;
  await updateDoc(doc(db, BOARDS, boardId), {
    members: arrayUnion(...uids),
    updatedAt: serverTimestamp(),
  });
}

export async function removeBoardMember(boardId, uid) {
  await updateDoc(doc(db, BOARDS, boardId), {
    members: arrayRemove(uid),
    updatedAt: serverTimestamp(),
  });
}

/* ──────────────────────────────────────────────────────────────────
   Columns
   ────────────────────────────────────────────────────────────────── */

export async function createColumn(boardId, { name, order }) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Kolumnnamn krävs.");
  if (trimmed.length > 60) throw new Error("Kolumnnamnet är för långt.");
  await addDoc(collection(db, BOARDS, boardId, COLUMNS), {
    name: trimmed,
    order: Number.isFinite(order) ? order : 0,
    createdAt: serverTimestamp(),
  });
}

export async function renameColumn(boardId, columnId, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Kolumnnamn krävs.");
  await updateDoc(doc(db, BOARDS, boardId, COLUMNS, columnId), {
    name: trimmed,
  });
}

/**
 * Delete a column AND every task inside it. Tasks are gone forever —
 * caller should confirm in UI before calling.
 */
export async function deleteColumnAndTasks(boardId, columnId) {
  const tasksSnap = await getDocs(
    query(collection(db, BOARDS, boardId, TASKS), where("columnId", "==", columnId))
  );

  // Best-effort delete each task's comments first.
  for (const taskDoc of tasksSnap.docs) {
    const cmts = await getDocs(
      collection(db, BOARDS, boardId, TASKS, taskDoc.id, COMMENTS)
    );
    if (!cmts.empty) {
      const batch = writeBatch(db);
      cmts.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Tasks.
  if (!tasksSnap.empty) {
    const batch = writeBatch(db);
    tasksSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Column.
  await deleteDoc(doc(db, BOARDS, boardId, COLUMNS, columnId));
}

/* ──────────────────────────────────────────────────────────────────
   Tasks
   ────────────────────────────────────────────────────────────────── */

export async function createTask(
  boardId,
  { columnId, title, creatorUid, order }
) {
  const trimmed = (title || "").trim();
  if (!trimmed) throw new Error("Titel krävs.");
  if (trimmed.length > 200) throw new Error("Titeln är för lång.");
  if (!columnId) throw new Error("Kolumn saknas.");

  await addDoc(collection(db, BOARDS, boardId, TASKS), {
    title: trimmed,
    description: "",
    columnId,
    order: Number.isFinite(order) ? order : 0,
    assignedUsers: [],
    labels: [],
    dueDate: null,
    checklist: [],
    commentsCount: 0,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTask(boardId, taskId, updates) {
  await updateDoc(doc(db, BOARDS, boardId, TASKS, taskId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(boardId, taskId) {
  // Best-effort: delete comments first (subcollections aren't auto-cleared).
  const cmts = await getDocs(
    collection(db, BOARDS, boardId, TASKS, taskId, COMMENTS)
  );
  if (!cmts.empty) {
    const batch = writeBatch(db);
    cmts.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(db, BOARDS, boardId, TASKS, taskId));
}

/**
 * Persist a new ordering for tasks within a single column. Caller
 * provides the tasks in their NEW order; this function renumbers
 * order=0..N-1 and writes the deltas in a single batch.
 */
export async function persistColumnOrder(boardId, columnId, orderedTasks) {
  const batch = writeBatch(db);
  orderedTasks.forEach((t, i) => {
    batch.update(doc(db, BOARDS, boardId, TASKS, t.id), {
      columnId,
      order: i,
    });
  });
  await batch.commit();
}

/**
 * Move a task across columns + place it at a given index. Batches the
 * source-column renumber, target-column renumber, and the task's own
 * columnId/order update.
 */
export async function persistCrossColumnMove(
  boardId,
  { taskId, fromColumnId, toColumnId, newSourceTasks, newDestTasks }
) {
  const batch = writeBatch(db);

  // Renumber source column (the task we moved is no longer there).
  newSourceTasks.forEach((t, i) => {
    batch.update(doc(db, BOARDS, boardId, TASKS, t.id), { order: i });
  });

  // Renumber destination column (includes the moved task at its new index).
  newDestTasks.forEach((t, i) => {
    batch.update(doc(db, BOARDS, boardId, TASKS, t.id), {
      columnId: toColumnId,
      order: i,
    });
  });

  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   Comments
   ────────────────────────────────────────────────────────────────── */

export async function addComment(boardId, taskId, userId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  if (trimmed.length > 2000) throw new Error("Kommentaren är för lång.");

  await addDoc(collection(db, BOARDS, boardId, TASKS, taskId, COMMENTS), {
    userId,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
  // Keep a denormalized count on the parent task so the card can show
  // a comment bubble without spinning up a comment-subcollection query.
  await updateDoc(doc(db, BOARDS, boardId, TASKS, taskId), {
    commentsCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteComment(boardId, taskId, commentId) {
  await deleteDoc(
    doc(db, BOARDS, boardId, TASKS, taskId, COMMENTS, commentId)
  );
  await updateDoc(doc(db, BOARDS, boardId, TASKS, taskId), {
    commentsCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}
