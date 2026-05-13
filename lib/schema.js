/**
 * Firestore Collection Names & Schema Constants
 * Central source of truth for all collection paths, enums, and field constants.
 */

// ─── Root Collections ──────────────────────────────────────────────
// Note: kunder, affärer och projekt ligger ALLA under teams/{teamId}/...
// — schema speglar bara root-namnen som faktiskt finns på top-level.
export const COLLECTIONS = {
  USERS: "users",
  TEAMS: "teams",
  FRIENDSHIPS: "friendships",
  FRIEND_REQUESTS: "friendRequests",
  CONVERSATIONS: "conversations",
  BOARDS: "boards",
};

// ─── Sub-Collections under teams/{teamId} ─────────────────────────
export const TEAM_SUB_COLLECTIONS = {
  CLIENTS: "clients",
  DEALS: "deals",
  PROJECTS: "projects",
  INVITATIONS: "invitations",
  COUNTERS: "counters", // teams/{teamId}/counters/{counterName} { next: N }
};

// ─── Sub-Collections under teams/{teamId}/clients/{clientId} ───────
export const CLIENT_SUB_COLLECTIONS = {
  CONTACTS: "contacts",     // kontaktpersoner
  ACTIVITY_LOGS: "activityLogs", // tidslinje
  INVOICES: "invoices",     // reskontra (manuell)
  FILES: "files",           // bilagor / dokument
  AUDIT_LOG: "auditLog",    // audit trail för edits
};

// ─── Sub-Collections under teams/{teamId}/projects/{projectId} ─────
export const PROJECT_SUB_COLLECTIONS = {
  TASKS: "tasks",
  BOARD_ITEMS: "boardItems",
  CONNECTIONS: "connections",
  EXPENSES: "expenses",
  PROFIT_SHARES: "profitShares",
  COMMENTS: "comments",
};

// ─── Deal Stages (Kanban columns, ordered) ──────────────────────────
export const DEAL_STAGES = [
  { id: "lead", label: "Lead / Prospekt", color: "#6366f1" },
  { id: "pitch_concept", label: "Pitch / Konceptutveckling", color: "#a855f7" },
  { id: "presentation_sent", label: "Presentation skickad", color: "#f59e0b" },
  { id: "negotiation", label: "Förhandling", color: "#f97316" },
  { id: "won", label: "VUNNEN", color: "#22c55e" },
  { id: "lost", label: "FÖRLORAD / PAUSAD", color: "#ef4444" },
];

export const DEAL_STAGE_IDS = DEAL_STAGES.map((s) => s.id);

// ─── Project Phases ────────────────────────────────────────────────
export const PROJECT_PHASES = [
  { id: "pre_production", label: "Förproduktion", color: "#6366f1" },
  { id: "production", label: "Produktion", color: "#f59e0b" },
  { id: "post_production", label: "Efterproduktion", color: "#a855f7" },
  { id: "delivery", label: "Leverans", color: "#22c55e" },
];

// ─── Post-Production Sub-Phases ────────────────────────────────────
export const POST_PRODUCTION_STEPS = [
  { id: "ingest_sync", label: "Import / Synk" },
  { id: "rough_cut", label: "Grovklipp" },
  { id: "client_feedback_v1", label: "Kundfeedback v1" },
  { id: "picture_lock", label: "Picture Lock" },
  { id: "color_grading_audio", label: "Färgkorrigering & Ljudmix" },
  { id: "vfx_graphics", label: "VFX / Grafik" },
];

// ─── Task Status ───────────────────────────────────────────────────
export const TASK_STATUSES = [
  { id: "todo", label: "Att göra", color: "#64748b" },
  { id: "in_progress", label: "Pågående", color: "#3b82f6" },
  { id: "review", label: "Granskning", color: "#f59e0b" },
  { id: "done", label: "Klart", color: "#22c55e" },
];

// ─── Task Priority ─────────────────────────────────────────────────
export const TASK_PRIORITIES = [
  { id: "low", label: "Låg", color: "#64748b" },
  { id: "medium", label: "Medel", color: "#3b82f6" },
  { id: "high", label: "Hög", color: "#f97316" },
  { id: "urgent", label: "Brådskande", color: "#ef4444" },
];

// ─── Project Status ────────────────────────────────────────────────
export const PROJECT_STATUSES = [
  { id: "active", label: "Aktiv", color: "#22c55e" },
  { id: "on_hold", label: "Pausad", color: "#f59e0b" },
  { id: "completed", label: "Avslutad", color: "#6366f1" },
  { id: "cancelled", label: "Avbruten", color: "#ef4444" },
];

// ─── Client Status (soft delete) ──────────────────────────────────
// Soft delete: arkiverade kunder är dolda från standard-listor men
// dokumenten ligger kvar. Hard delete kräver att alla subcollections
// är tomma OCH att inga deals/projekt referar till kunden.
export const CLIENT_STATUSES = [
  { id: "active", label: "Aktiv", color: "#22c55e" },
  { id: "archived", label: "Arkiverad", color: "#94a3b8" },
];

// ─── Invoice Status (reskontra, manuell) ──────────────────────────
// Flödet (typiskt): draft → sent → paid. "overdue" sätts av UI/queries
// när status==sent och dueDate < idag — vi lagrar inte "overdue" som
// ett persistent tillstånd för att slippa cron-jobb.
export const INVOICE_STATUSES = [
  { id: "draft", label: "Utkast", color: "#94a3b8" },
  { id: "sent", label: "Skickad", color: "#f59e0b" },
  { id: "paid", label: "Betald", color: "#22c55e" },
  { id: "cancelled", label: "Annullerad", color: "#ef4444" },
];

// ─── Audit Log Actions ────────────────────────────────────────────
export const AUDIT_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  ARCHIVE: "archive",
  RESTORE: "restore",
  DELETE: "delete",
  // Sub-entiteter
  CONTACT_ADD: "contact_add",
  CONTACT_UPDATE: "contact_update",
  CONTACT_DELETE: "contact_delete",
  ACTIVITY_ADD: "activity_add",
  ACTIVITY_DELETE: "activity_delete",
  INVOICE_ADD: "invoice_add",
  INVOICE_UPDATE: "invoice_update",
  INVOICE_PAYMENT: "invoice_payment",
  INVOICE_DELETE: "invoice_delete",
  FILE_ADD: "file_add",
  FILE_DELETE: "file_delete",
};

// ─── Activity Log Types ────────────────────────────────────────────
export const ACTIVITY_TYPES = [
  { id: "note", label: "Anteckning", icon: "StickyNote" },
  { id: "call", label: "Samtal", icon: "Phone" },
  { id: "email", label: "E-post", icon: "Mail" },
  { id: "meeting", label: "Möte", icon: "Users" },
];

// ─── Currencies ────────────────────────────────────────────────────
export const CURRENCIES = [
  { id: "EUR", label: "EUR (€)", symbol: "€" },
  { id: "USD", label: "USD ($)", symbol: "$" },
  { id: "SEK", label: "SEK (kr)", symbol: "kr" },
  { id: "GBP", label: "GBP (£)", symbol: "£" },
];

// ─── Industries ────────────────────────────────────────────────────
export const INDUSTRIES = [
  "Fordon",
  "Skönhet & Kosmetik",
  "E-handel",
  "Underhållning",
  "Mode",
  "Finans",
  "Mat & Dryck",
  "Hälsa & Sjukvård",
  "Lyx",
  "Musik",
  "Ideell",
  "Fastigheter",
  "Detaljhandel",
  "Sport",
  "Teknik",
  "Resor & Hotell",
  "Övrigt",
];

// ─── Post-Production Task Templates ────────────────────────────────
// These are auto-created when a project enters post-production
export const POST_PRODUCTION_TASK_TEMPLATES = [
  {
    title: "Ingest & Sync footage",
    phase: "post_production",
    subPhase: "ingest_sync",
    priority: "high",
  },
  {
    title: "Rough Cut assembly",
    phase: "post_production",
    subPhase: "rough_cut",
    priority: "high",
  },
  {
    title: "Client Feedback v1",
    phase: "post_production",
    subPhase: "client_feedback_v1",
    priority: "medium",
  },
  {
    title: "Picture Lock",
    phase: "post_production",
    subPhase: "picture_lock",
    priority: "high",
  },
  {
    title: "Color Grading",
    phase: "post_production",
    subPhase: "color_grading_audio",
    priority: "medium",
  },
  {
    title: "Audio Mix & Sound Design",
    phase: "post_production",
    subPhase: "color_grading_audio",
    priority: "medium",
  },
  {
    title: "VFX & Motion Graphics",
    phase: "post_production",
    subPhase: "vfx_graphics",
    priority: "medium",
  },
];
