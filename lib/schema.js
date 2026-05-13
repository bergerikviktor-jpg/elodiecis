/**
 * Firestore Collection Names & Schema Constants
 * Central source of truth for all collection paths, enums, and field constants.
 */

// ─── Root Collections ──────────────────────────────────────────────
export const COLLECTIONS = {
  USERS: "users",
  CLIENTS: "clients",
  DEALS: "deals",
  PROJECTS: "projects",
};

// ─── Sub-Collections ───────────────────────────────────────────────
export const SUB_COLLECTIONS = {
  CONTACTS: "contacts", // clients/{id}/contacts
  BRAND_ASSETS: "brandAssets", // clients/{id}/brandAssets
  ACTIVITY_LOGS: "activityLogs", // clients/{id}/activityLogs
  TASKS: "tasks", // projects/{id}/tasks
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
