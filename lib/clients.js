/**
 * Client (kund) operations.
 *
 * Kunder ligger som en subcollection under sitt team:
 *   teams/{teamId}/clients/{clientId}
 *
 * Subcollections under varje kund:
 *   contacts/{id}       — kontaktpersoner
 *   activityLogs/{id}   — tidslinje (anteckning, samtal, möte, e-post)
 *   invoices/{id}       — reskontra (manuell, ingen integration)
 *   files/{id}          — bilagor (Firebase Storage-länkar)
 *   auditLog/{id}       — audit trail för ALLA mutationer (vem/när/vad)
 *
 * Designval:
 *   - Kundnummer ("KUND-0042") genereras med en räknare i
 *     teams/{teamId}/counters/clients. Transaktionell — två parallella
 *     creates ger ALDRIG samma nummer.
 *   - Soft delete: archiveClient sätter status="archived". Standard-
 *     listor filtrerar bort dem. hardDeleteClient kräver tomma sub-
 *     collections OCH inga deals/projekt som referar till kunden.
 *   - Dubblettkontroll: före create körs en query mot orgNumberDigits.
 *     Inte transaktionell — race-villkor är teoretiskt möjligt men
 *     extremt osannolikt. Det värsta som händer är två dubblettkunder
 *     som någon manuellt rensar.
 *   - Audit log: VARJE mutation skriver en post i auditLog/{id} via
 *     samma batch som själva ändringen. Diffen är topp-nivå-fält
 *     (inte djup) för att hålla docen liten och läsbar.
 *   - Outstanding balance + total revenue på kund-doc är denormaliserade
 *     caches. addInvoice/recordPayment bumpar dem atomärt med
 *     increment() i samma batch.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  CLIENT_SUB_COLLECTIONS,
  TEAM_SUB_COLLECTIONS,
  AUDIT_ACTIONS,
  INDUSTRIES,
} from "@/lib/schema";
import {
  isValidOrgNumber,
  normalizeOrgNumber,
} from "@/lib/orgnumber";

/* ──────────────────────────────────────────────────────────────────
   Konstanter & path-helpers
   ────────────────────────────────────────────────────────────────── */

const TEAMS = "teams";
const CLIENTS = TEAM_SUB_COLLECTIONS.CLIENTS;
const COUNTERS = TEAM_SUB_COLLECTIONS.COUNTERS;
const { CONTACTS, ACTIVITY_LOGS, INVOICES, FILES, AUDIT_LOG } = CLIENT_SUB_COLLECTIONS;

const CLIENT_COUNTER_ID = "clients";

const clientCol = (teamId) => collection(db, TEAMS, teamId, CLIENTS);
const clientDoc = (teamId, clientId) => doc(db, TEAMS, teamId, CLIENTS, clientId);
const counterDoc = (teamId) => doc(db, TEAMS, teamId, COUNTERS, CLIENT_COUNTER_ID);
const subCol = (teamId, clientId, name) =>
  collection(db, TEAMS, teamId, CLIENTS, clientId, name);
const subDoc = (teamId, clientId, name, id) =>
  doc(db, TEAMS, teamId, CLIENTS, clientId, name, id);

/* ──────────────────────────────────────────────────────────────────
   Formattering & validering
   ────────────────────────────────────────────────────────────────── */

/** "KUND-0042". Zero-pad 4 siffror; växer naturligt vid >9999. */
export function formatClientNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return "";
  return `KUND-${String(num).padStart(4, "0")}`;
}

/**
 * Kontrollera om ett orgnummer redan finns i teamets kunder.
 * Returnerar id för existerande kund, eller null.
 *
 * `excludeClientId` används vid edit — exkluderar kunden som
 * uppdateras så vi inte rapporterar oss själva som dubblett.
 */
export async function checkOrgNumberExists(teamId, orgNumberDigits, excludeClientId = null) {
  if (!teamId || !orgNumberDigits) return null;
  const q = query(
    clientCol(teamId),
    where("orgNumberDigits", "==", orgNumberDigits),
    limit(2) // 2 räcker för att avgöra om det finns någon "annan"
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (d.id !== excludeClientId) return d.id;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────
   Audit log (internal helper)
   ────────────────────────────────────────────────────────────────── */

/**
 * Lägg till en audit-post i samma batch som mutationen.
 * `details` är fri-form — caller bestämmer struktur per action.
 */
function appendAudit(batch, teamId, clientId, actorUid, action, details = {}) {
  const ref = doc(subCol(teamId, clientId, AUDIT_LOG));
  batch.set(ref, {
    action,
    actorUid,
    details,
    createdAt: serverTimestamp(),
  });
}

/**
 * Diffa två topp-nivå-objekt och returnera { fieldName: { before, after } }
 * bara för fält som faktiskt ändrats. Nestade objekt jämförs via JSON-
 * serialisering (grovt men tillräckligt för audit-syften).
 */
function diffTopLevel(before, after) {
  const changes = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    const a = before?.[k];
    const b = after?.[k];
    const sa = JSON.stringify(a ?? null);
    const sb = JSON.stringify(b ?? null);
    if (sa !== sb) changes[k] = { before: a ?? null, after: b ?? null };
  }
  return changes;
}

/* ──────────────────────────────────────────────────────────────────
   CREATE
   ────────────────────────────────────────────────────────────────── */

/**
 * Skapa en kund i ett team.
 *
 * Returnerar { id, clientNumber }.
 *
 * Kastar Error om:
 *   - Obligatoriska fält saknas
 *   - Orgnummer ogiltigt (Luhn)
 *   - Orgnummer redan används av annan kund i samma team
 *   - accountManagerUid inte är medlem av teamet (caller's ansvar att
 *     skicka rätt — vi kontrollerar inte här för att undvika extra read)
 */
export async function createClient(teamId, creatorUid, input) {
  if (!teamId || !creatorUid) throw new Error("Saknar parameter.");

  const companyName = (input.companyName || "").trim();
  if (!companyName) throw new Error("Företagsnamn krävs.");
  if (companyName.length > 200) throw new Error("Företagsnamnet är för långt.");

  const orgDigits = normalizeOrgNumber(input.orgNumber);
  if (!isValidOrgNumber(orgDigits)) {
    throw new Error("Ogiltigt organisationsnummer.");
  }

  // Dubblettkontroll — best effort, ej transaktionell.
  const existingId = await checkOrgNumberExists(teamId, orgDigits);
  if (existingId) {
    const err = new Error("En kund med detta organisationsnummer finns redan.");
    err.code = "duplicate-org-number";
    err.existingClientId = existingId;
    throw err;
  }

  const industry = (input.industry || "").trim();
  if (industry && !INDUSTRIES.includes(industry)) {
    throw new Error("Okänd bransch.");
  }

  const accountManagerUid = input.accountManagerUid || creatorUid;
  const paymentTermDays = Number.isFinite(input.paymentTermDays)
    ? Math.max(0, Math.floor(input.paymentTermDays))
    : 30;
  const defaultCurrency = input.defaultCurrency || "SEK";

  const billing = sanitizeAddress(input.billing);
  const visit = sanitizeAddress(input.visit);
  const tags = Array.isArray(input.tags)
    ? input.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
    : [];
  const vatNumber = (input.vatNumber || "").trim().toUpperCase();
  const notes = (input.notes || "").trim();

  // Transaktion: läs+inkrementera counter, skapa kund + första audit-post.
  // Allt sker atomärt → ingen risk för dubbla kundnummer.
  const result = await runTransaction(db, async (tx) => {
    const counterRef = counterDoc(teamId);
    const counterSnap = await tx.get(counterRef);
    const next = counterSnap.exists() ? (counterSnap.data().next || 1) : 1;

    const clientNumber = formatClientNumber(next);
    const newClientRef = doc(clientCol(teamId)); // auto-id
    const auditRef = doc(collection(newClientRef, AUDIT_LOG));

    const payload = {
      companyName,
      companyNameLower: companyName.toLowerCase(),
      orgNumber: formatDashedOrg(orgDigits),
      orgNumberDigits: orgDigits,
      clientNumber,
      clientNumberDigits: next,
      industry,
      status: "active",
      accountManagerUid,
      billing,
      visit,
      vatNumber,
      paymentTermDays,
      defaultCurrency,
      tags,
      notes,
      // Denormaliserade caches — uppdateras av invoice/deal/project-ops.
      outstandingBalance: 0,
      totalRevenue: 0,
      activeDealsCount: 0,
      activeProjectsCount: 0,
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    tx.set(counterRef, { next: next + 1, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(newClientRef, payload);
    tx.set(auditRef, {
      action: AUDIT_ACTIONS.CREATE,
      actorUid: creatorUid,
      details: { clientNumber, companyName },
      createdAt: serverTimestamp(),
    });

    return { id: newClientRef.id, clientNumber };
  });

  return result;
}

function sanitizeAddress(addr) {
  if (!addr || typeof addr !== "object") return null;
  const a = {
    address: (addr.address || "").trim(),
    postalCode: (addr.postalCode || "").trim(),
    city: (addr.city || "").trim(),
    country: (addr.country || "SE").trim().toUpperCase(),
  };
  // Returnera null om alla fält är tomma — slipper lagra skräp.
  if (!a.address && !a.postalCode && !a.city) return null;
  return a;
}

function formatDashedOrg(digits) {
  return digits.length === 10 ? `${digits.slice(0, 6)}-${digits.slice(6)}` : digits;
}

/* ──────────────────────────────────────────────────────────────────
   UPDATE / ARCHIVE / RESTORE / HARD DELETE
   ────────────────────────────────────────────────────────────────── */

/**
 * Patcha kunden. Skickar bara de fält som ändras. Skriver en
 * audit-post med diff över de fält som faktiskt förändrades.
 *
 * Orgnummer-ändring körs genom samma valideringar som create.
 */
export async function updateClient(teamId, clientId, actorUid, updates) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");

  const ref = clientDoc(teamId, clientId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Kunden finns inte.");
  const before = snap.data();

  const patch = {};

  if (updates.companyName !== undefined) {
    const v = String(updates.companyName).trim();
    if (!v) throw new Error("Företagsnamn krävs.");
    if (v.length > 200) throw new Error("Företagsnamnet är för långt.");
    patch.companyName = v;
    patch.companyNameLower = v.toLowerCase();
  }

  if (updates.orgNumber !== undefined) {
    const digits = normalizeOrgNumber(updates.orgNumber);
    if (!isValidOrgNumber(digits)) throw new Error("Ogiltigt organisationsnummer.");
    if (digits !== before.orgNumberDigits) {
      const dupId = await checkOrgNumberExists(teamId, digits, clientId);
      if (dupId) {
        const err = new Error("En kund med detta organisationsnummer finns redan.");
        err.code = "duplicate-org-number";
        err.existingClientId = dupId;
        throw err;
      }
    }
    patch.orgNumber = formatDashedOrg(digits);
    patch.orgNumberDigits = digits;
  }

  if (updates.industry !== undefined) {
    const v = String(updates.industry).trim();
    if (v && !INDUSTRIES.includes(v)) throw new Error("Okänd bransch.");
    patch.industry = v;
  }

  if (updates.accountManagerUid !== undefined) {
    patch.accountManagerUid = String(updates.accountManagerUid);
  }
  if (updates.paymentTermDays !== undefined) {
    const n = Number(updates.paymentTermDays);
    patch.paymentTermDays = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 30;
  }
  if (updates.defaultCurrency !== undefined) {
    patch.defaultCurrency = String(updates.defaultCurrency || "SEK");
  }
  if (updates.vatNumber !== undefined) {
    patch.vatNumber = String(updates.vatNumber || "").trim().toUpperCase();
  }
  if (updates.notes !== undefined) {
    patch.notes = String(updates.notes || "").trim();
  }
  if (updates.billing !== undefined) {
    patch.billing = sanitizeAddress(updates.billing);
  }
  if (updates.visit !== undefined) {
    patch.visit = sanitizeAddress(updates.visit);
  }
  if (updates.tags !== undefined) {
    patch.tags = Array.isArray(updates.tags)
      ? updates.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 20)
      : [];
  }

  if (Object.keys(patch).length === 0) return; // ingen ändring

  const changes = diffTopLevel(
    Object.fromEntries(Object.keys(patch).map((k) => [k, before[k] ?? null])),
    patch
  );

  patch.updatedAt = serverTimestamp();

  const batch = writeBatch(db);
  batch.update(ref, patch);
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.UPDATE, { changes });
  await batch.commit();
}

/** Soft delete — sätt status="archived". */
export async function archiveClient(teamId, clientId, actorUid) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");
  const batch = writeBatch(db);
  batch.update(clientDoc(teamId, clientId), {
    status: "archived",
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.ARCHIVE);
  await batch.commit();
}

/** Ångra arkivering. */
export async function restoreClient(teamId, clientId, actorUid) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");
  const batch = writeBatch(db);
  batch.update(clientDoc(teamId, clientId), {
    status: "active",
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.RESTORE);
  await batch.commit();
}

/**
 * Permanent radering. Säkerhetscheck först:
 *   - Alla subcollections (kontakter, aktivitet, fakturor, filer) tomma
 *   - Inga deals eller projekt referar via clientId
 *
 * Kastar med en `code` ifall något blockerar.
 */
export async function hardDeleteClient(teamId, clientId, actorUid) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");

  // Subcollection-check (exklusive auditLog — den får följa med dokumentet).
  const subs = [CONTACTS, ACTIVITY_LOGS, INVOICES, FILES];
  for (const name of subs) {
    const snap = await getDocs(query(subCol(teamId, clientId, name), limit(1)));
    if (!snap.empty) {
      const err = new Error(`Kan inte radera: kunden har ${labelForSub(name)}.`);
      err.code = "has-children";
      err.children = name;
      throw err;
    }
  }

  // Cross-referenser: deals & projects.
  for (const sub of ["deals", "projects"]) {
    const q = query(
      collection(db, TEAMS, teamId, sub),
      where("clientId", "==", clientId),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const err = new Error(
        `Kan inte radera: kunden är kopplad till en eller flera ${sub === "deals" ? "affärer" : "projekt"}.`
      );
      err.code = "has-refs";
      err.refs = sub;
      throw err;
    }
  }

  // Radera auditLog → sen kunden själv.
  const auditSnap = await getDocs(subCol(teamId, clientId, AUDIT_LOG));
  if (!auditSnap.empty) {
    const batch = writeBatch(db);
    auditSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(clientDoc(teamId, clientId));
}

function labelForSub(name) {
  switch (name) {
    case CONTACTS: return "kontaktpersoner";
    case ACTIVITY_LOGS: return "aktivitetsloggar";
    case INVOICES: return "fakturor";
    case FILES: return "filer";
    default: return "underdata";
  }
}

/* ──────────────────────────────────────────────────────────────────
   CONTACTS
   ────────────────────────────────────────────────────────────────── */

export async function addContact(teamId, clientId, actorUid, input) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");
  const firstName = (input.firstName || "").trim();
  const lastName = (input.lastName || "").trim();
  if (!firstName && !lastName) throw new Error("Ange för- eller efternamn.");

  const isPrimary = !!input.isPrimary;

  const ref = doc(subCol(teamId, clientId, CONTACTS));
  const batch = writeBatch(db);

  // Om denna ska vara primärkontakt — rensa flaggan på alla andra.
  if (isPrimary) {
    const others = await getDocs(
      query(subCol(teamId, clientId, CONTACTS), where("isPrimary", "==", true))
    );
    others.docs.forEach((d) => batch.update(d.ref, { isPrimary: false }));
  }

  const payload = {
    firstName,
    lastName,
    title: (input.title || "").trim(),
    email: (input.email || "").trim().toLowerCase(),
    phone: (input.phone || "").trim(),
    isPrimary,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  batch.set(ref, payload);
  batch.update(clientDoc(teamId, clientId), { updatedAt: serverTimestamp() });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.CONTACT_ADD, {
    contactId: ref.id,
    name: `${firstName} ${lastName}`.trim(),
  });
  await batch.commit();
  return ref.id;
}

export async function updateContact(teamId, clientId, contactId, actorUid, updates) {
  if (!teamId || !clientId || !contactId || !actorUid) throw new Error("Saknar parameter.");

  const patch = {};
  if (updates.firstName !== undefined) patch.firstName = String(updates.firstName).trim();
  if (updates.lastName !== undefined) patch.lastName = String(updates.lastName).trim();
  if (updates.title !== undefined) patch.title = String(updates.title).trim();
  if (updates.email !== undefined) patch.email = String(updates.email).trim().toLowerCase();
  if (updates.phone !== undefined) patch.phone = String(updates.phone).trim();
  if (updates.isPrimary !== undefined) patch.isPrimary = !!updates.isPrimary;

  if (Object.keys(patch).length === 0) return;

  const batch = writeBatch(db);

  if (patch.isPrimary === true) {
    // Rensa primary på alla andra.
    const others = await getDocs(
      query(subCol(teamId, clientId, CONTACTS), where("isPrimary", "==", true))
    );
    others.docs.forEach((d) => {
      if (d.id !== contactId) batch.update(d.ref, { isPrimary: false });
    });
  }

  patch.updatedAt = serverTimestamp();
  batch.update(subDoc(teamId, clientId, CONTACTS, contactId), patch);
  batch.update(clientDoc(teamId, clientId), { updatedAt: serverTimestamp() });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.CONTACT_UPDATE, {
    contactId,
    changes: Object.keys(patch).filter((k) => k !== "updatedAt"),
  });
  await batch.commit();
}

export async function deleteContact(teamId, clientId, contactId, actorUid) {
  if (!teamId || !clientId || !contactId || !actorUid) throw new Error("Saknar parameter.");
  const batch = writeBatch(db);
  batch.delete(subDoc(teamId, clientId, CONTACTS, contactId));
  batch.update(clientDoc(teamId, clientId), { updatedAt: serverTimestamp() });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.CONTACT_DELETE, { contactId });
  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   ACTIVITY LOG
   ────────────────────────────────────────────────────────────────── */

const ACTIVITY_TYPE_IDS = ["note", "call", "email", "meeting"];

export async function addActivityLog(teamId, clientId, actorUid, input) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");
  const type = ACTIVITY_TYPE_IDS.includes(input.type) ? input.type : "note";
  const title = (input.title || "").trim();
  const body = (input.body || "").trim();
  if (!title && !body) throw new Error("Skriv en titel eller text.");

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
  const validOccurred = !Number.isNaN(occurredAt.getTime()) ? occurredAt : new Date();

  const ref = doc(subCol(teamId, clientId, ACTIVITY_LOGS));
  const batch = writeBatch(db);
  batch.set(ref, {
    type,
    title,
    body,
    authorUid: actorUid,
    relatedContactIds: Array.isArray(input.relatedContactIds)
      ? input.relatedContactIds.filter(Boolean)
      : [],
    occurredAt: validOccurred,
    createdAt: serverTimestamp(),
  });
  batch.update(clientDoc(teamId, clientId), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.ACTIVITY_ADD, {
    logId: ref.id,
    type,
    title,
  });
  await batch.commit();
  return ref.id;
}

export async function deleteActivityLog(teamId, clientId, logId, actorUid) {
  if (!teamId || !clientId || !logId || !actorUid) throw new Error("Saknar parameter.");
  const batch = writeBatch(db);
  batch.delete(subDoc(teamId, clientId, ACTIVITY_LOGS, logId));
  batch.update(clientDoc(teamId, clientId), { updatedAt: serverTimestamp() });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.ACTIVITY_DELETE, { logId });
  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   INVOICES (reskontra, manuell)
   ────────────────────────────────────────────────────────────────── */

function computeInvoiceTotals(amountExVat, vatRatePercent) {
  const ex = Math.max(0, Math.round(Number(amountExVat) || 0));
  const rate = Number.isFinite(vatRatePercent) ? Math.max(0, vatRatePercent) : 25;
  const vat = Math.round(ex * (rate / 100));
  return { amountExVat: ex, vatRate: rate, vatAmount: vat, amountIncVat: ex + vat };
}

export async function addInvoice(teamId, clientId, actorUid, input) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");
  const invoiceNumber = (input.invoiceNumber || "").trim();
  if (!invoiceNumber) throw new Error("Fakturanummer krävs.");

  const totals = computeInvoiceTotals(input.amountExVat, input.vatRate);
  if (totals.amountExVat <= 0) throw new Error("Beloppet måste vara större än 0.");

  const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;

  const status = ["draft", "sent", "paid", "cancelled"].includes(input.status)
    ? input.status
    : "draft";

  const ref = doc(subCol(teamId, clientId, INVOICES));
  const batch = writeBatch(db);

  const payload = {
    invoiceNumber,
    issueDate,
    dueDate,
    ...totals,
    currency: input.currency || "SEK",
    status,
    paidAt: status === "paid" ? (input.paidAt ? new Date(input.paidAt) : new Date()) : null,
    paidAmount: status === "paid" ? totals.amountIncVat : 0,
    description: (input.description || "").trim(),
    reference: (input.reference || "").trim(),
    relatedProjectId: input.relatedProjectId || null,
    createdBy: actorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  batch.set(ref, payload);

  // Cache: utestående = ex-moms-belopp om status är sent/draft.
  // Hoppar drafts ifrån cachen för att inte räkna "ej skickade".
  const outstandingDelta = status === "sent" ? totals.amountExVat : 0;
  const revenueDelta = status === "paid" ? totals.amountExVat : 0;

  batch.update(clientDoc(teamId, clientId), {
    outstandingBalance: increment(outstandingDelta),
    totalRevenue: increment(revenueDelta),
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.INVOICE_ADD, {
    invoiceId: ref.id,
    invoiceNumber,
    amountExVat: totals.amountExVat,
    status,
  });
  await batch.commit();
  return ref.id;
}

/**
 * Patcha en faktura. Hanterar status-övergångar och håller cache-fälten
 * på kund-doc synkade.
 *
 * Tillåtna fält: invoiceNumber, issueDate, dueDate, amountExVat, vatRate,
 * status, description, reference, relatedProjectId.
 *
 * För status-byte "betala" — använd hellre recordInvoicePayment.
 */
export async function updateInvoice(teamId, clientId, invoiceId, actorUid, updates) {
  if (!teamId || !clientId || !invoiceId || !actorUid) throw new Error("Saknar parameter.");

  const ref = subDoc(teamId, clientId, INVOICES, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Fakturan finns inte.");
  const before = snap.data();

  const patch = {};

  if (updates.invoiceNumber !== undefined) {
    const v = String(updates.invoiceNumber).trim();
    if (!v) throw new Error("Fakturanummer krävs.");
    patch.invoiceNumber = v;
  }
  if (updates.issueDate !== undefined) patch.issueDate = new Date(updates.issueDate);
  if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
  if (updates.description !== undefined) patch.description = String(updates.description).trim();
  if (updates.reference !== undefined) patch.reference = String(updates.reference).trim();
  if (updates.relatedProjectId !== undefined) patch.relatedProjectId = updates.relatedProjectId || null;
  if (updates.currency !== undefined) patch.currency = updates.currency || "SEK";

  let newTotals = null;
  if (updates.amountExVat !== undefined || updates.vatRate !== undefined) {
    newTotals = computeInvoiceTotals(
      updates.amountExVat !== undefined ? updates.amountExVat : before.amountExVat,
      updates.vatRate !== undefined ? updates.vatRate : before.vatRate
    );
    Object.assign(patch, newTotals);
  }

  let newStatus = before.status;
  if (updates.status !== undefined && updates.status !== before.status) {
    if (!["draft", "sent", "paid", "cancelled"].includes(updates.status)) {
      throw new Error("Ogiltig status.");
    }
    newStatus = updates.status;
    patch.status = newStatus;
    if (newStatus === "paid" && !before.paidAt) {
      patch.paidAt = new Date();
      patch.paidAmount = (newTotals || before).amountIncVat;
    }
    if (newStatus !== "paid") {
      patch.paidAt = null;
      patch.paidAmount = 0;
    }
  }

  if (Object.keys(patch).length === 0) return;

  // Beräkna cache-deltan på kund-doc baserat på status & belopp.
  const oldOutstanding = before.status === "sent" ? before.amountExVat : 0;
  const oldRevenue = before.status === "paid" ? before.amountExVat : 0;
  const finalExVat = (newTotals || before).amountExVat;
  const newOutstanding = newStatus === "sent" ? finalExVat : 0;
  const newRevenue = newStatus === "paid" ? finalExVat : 0;

  patch.updatedAt = serverTimestamp();

  const batch = writeBatch(db);
  batch.update(ref, patch);
  batch.update(clientDoc(teamId, clientId), {
    outstandingBalance: increment(newOutstanding - oldOutstanding),
    totalRevenue: increment(newRevenue - oldRevenue),
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.INVOICE_UPDATE, {
    invoiceId,
    changes: Object.keys(patch).filter((k) => k !== "updatedAt"),
  });
  await batch.commit();
}

/**
 * Markera en faktura som betald (eller delbetald).
 *
 * Om paidAmount < amountIncVat lämnas status="sent" och paidAmount
 * lagras. Annars sätts status="paid".
 */
export async function recordInvoicePayment(teamId, clientId, invoiceId, actorUid, { paidAmount, paidAt }) {
  if (!teamId || !clientId || !invoiceId || !actorUid) throw new Error("Saknar parameter.");

  const ref = subDoc(teamId, clientId, INVOICES, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Fakturan finns inte.");
  const before = snap.data();
  if (before.status === "cancelled") throw new Error("Annullerad faktura kan inte betalas.");

  const newPaidAmount = Math.max(0, Math.round(Number(paidAmount) || 0));
  if (newPaidAmount === 0) throw new Error("Belopp måste vara större än 0.");

  const fullyPaid = newPaidAmount >= before.amountIncVat;
  const newStatus = fullyPaid ? "paid" : "sent";

  // Cache-delta: när fakturan blir helt betald flyttas exVat-beloppet
  // från outstanding till revenue.
  const oldOutstanding = before.status === "sent" ? before.amountExVat : 0;
  const newOutstanding = newStatus === "sent" ? before.amountExVat : 0;
  const oldRevenue = before.status === "paid" ? before.amountExVat : 0;
  const newRevenue = newStatus === "paid" ? before.amountExVat : 0;

  const batch = writeBatch(db);
  batch.update(ref, {
    status: newStatus,
    paidAmount: newPaidAmount,
    paidAt: fullyPaid ? (paidAt ? new Date(paidAt) : new Date()) : null,
    updatedAt: serverTimestamp(),
  });
  batch.update(clientDoc(teamId, clientId), {
    outstandingBalance: increment(newOutstanding - oldOutstanding),
    totalRevenue: increment(newRevenue - oldRevenue),
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.INVOICE_PAYMENT, {
    invoiceId,
    paidAmount: newPaidAmount,
    fullyPaid,
  });
  await batch.commit();
}

export async function deleteInvoice(teamId, clientId, invoiceId, actorUid) {
  if (!teamId || !clientId || !invoiceId || !actorUid) throw new Error("Saknar parameter.");

  const ref = subDoc(teamId, clientId, INVOICES, invoiceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const before = snap.data();

  const oldOutstanding = before.status === "sent" ? before.amountExVat : 0;
  const oldRevenue = before.status === "paid" ? before.amountExVat : 0;

  const batch = writeBatch(db);
  batch.delete(ref);
  batch.update(clientDoc(teamId, clientId), {
    outstandingBalance: increment(-oldOutstanding),
    totalRevenue: increment(-oldRevenue),
    updatedAt: serverTimestamp(),
  });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.INVOICE_DELETE, {
    invoiceId,
    invoiceNumber: before.invoiceNumber,
  });
  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   FILES (bilagor i Firebase Storage)
   ────────────────────────────────────────────────────────────────── */

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = /^(image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel|text\/)/;

export async function uploadClientFile(teamId, clientId, file, actorUid, { category } = {}) {
  if (!teamId || !clientId || !actorUid) throw new Error("Saknar parameter.");
  if (!file) throw new Error("Ingen fil vald.");
  if (file.size > MAX_FILE_BYTES) throw new Error("Filen är större än 10 MB.");
  if (file.type && !ALLOWED_FILE_TYPES.test(file.type)) {
    throw new Error("Filtypen stöds inte.");
  }

  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const storagePath = `clients/${teamId}/${clientId}/${Date.now()}_${safeName}`;
  const sref = storageRef(storage, storagePath);
  const snap = await uploadBytes(sref, file, { contentType: file.type || "application/octet-stream" });
  const downloadURL = await getDownloadURL(snap.ref);

  const ref = doc(subCol(teamId, clientId, FILES));
  const batch = writeBatch(db);
  batch.set(ref, {
    name: safeName,
    originalName: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    storagePath,
    downloadURL,
    category: category || null,
    uploadedBy: actorUid,
    uploadedAt: serverTimestamp(),
  });
  batch.update(clientDoc(teamId, clientId), { updatedAt: serverTimestamp() });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.FILE_ADD, {
    fileId: ref.id,
    name: safeName,
    size: file.size,
  });
  await batch.commit();
  return ref.id;
}

export async function deleteClientFile(teamId, clientId, fileId, storagePath, actorUid) {
  if (!teamId || !clientId || !fileId || !actorUid) throw new Error("Saknar parameter.");

  // Försök radera från Storage först — om Firestore-radera failar har vi
  // bara en orphan-fil i Storage, inte en orphan-länk i UI.
  if (storagePath) {
    try {
      await deleteObject(storageRef(storage, storagePath));
    } catch (err) {
      // Filen kan redan vara borta — fortsätt ändå med Firestore-radering.
      if (err?.code !== "storage/object-not-found") {
        console.warn("deleteClientFile: storage delete failed", err);
      }
    }
  }

  const batch = writeBatch(db);
  batch.delete(subDoc(teamId, clientId, FILES, fileId));
  batch.update(clientDoc(teamId, clientId), { updatedAt: serverTimestamp() });
  appendAudit(batch, teamId, clientId, actorUid, AUDIT_ACTIONS.FILE_DELETE, { fileId });
  await batch.commit();
}

/* ──────────────────────────────────────────────────────────────────
   GDPR EXPORT
   ────────────────────────────────────────────────────────────────── */

/**
 * Returnerar en plain-object med ALL data om kunden (huvuddoc +
 * subcollections, inklusive auditLog). Caller kan JSON.stringify-a
 * och låta browsern ladda ner.
 *
 * Note: timestamps serialiseras som ISO-strings för läsbarhet.
 */
export async function exportClientData(teamId, clientId) {
  if (!teamId || !clientId) throw new Error("Saknar parameter.");

  const mainSnap = await getDoc(clientDoc(teamId, clientId));
  if (!mainSnap.exists()) throw new Error("Kunden finns inte.");

  const subs = [CONTACTS, ACTIVITY_LOGS, INVOICES, FILES, AUDIT_LOG];
  const subSnaps = await Promise.all(
    subs.map((name) => getDocs(subCol(teamId, clientId, name)))
  );

  return {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    teamId,
    clientId,
    client: serializeDoc(mainSnap),
    contacts: subSnaps[0].docs.map(serializeDoc),
    activityLogs: subSnaps[1].docs.map(serializeDoc),
    invoices: subSnaps[2].docs.map(serializeDoc),
    files: subSnaps[3].docs.map(serializeDoc),
    auditLog: subSnaps[4].docs.map(serializeDoc),
  };
}

function serializeDoc(snap) {
  const data = snap.data();
  const out = { id: snap.id };
  for (const [k, v] of Object.entries(data)) {
    out[k] = serializeValue(v);
  }
  return out;
}

function serializeValue(v) {
  if (v === null || v === undefined) return v;
  // Firestore Timestamp har toDate()
  if (typeof v === "object" && typeof v.toDate === "function") {
    return v.toDate().toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = serializeValue(x);
    return out;
  }
  return v;
}

/* ──────────────────────────────────────────────────────────────────
   Cleanup (för deleteTeam, om det någonsin används)
   ────────────────────────────────────────────────────────────────── */

export async function deleteAllClientsForTeam(teamId) {
  const snap = await getDocs(clientCol(teamId));
  if (snap.empty) return;
  // Vi raderar inte subcollections rekursivt här — Firestore-quotor
  // gör det opraktiskt klientside. Den här pathen används inte i
  // dagens UI; om/när deleteTeam implementeras får vi en Cloud
  // Function eller batch-script.
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
