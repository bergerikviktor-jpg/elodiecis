/**
 * Utility functions for Elodie CRM
 */

/**
 * Merge class names, filtering out falsy values
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Format a Firestore Timestamp or Date to a readable string
 */
export function formatDate(timestamp, options = {}) {
  if (!timestamp) return "—";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a Firestore Timestamp to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just nu";
  if (diffMins < 60) return `${diffMins} min sedan`;
  if (diffHours < 24) return `${diffHours} tim sedan`;
  if (diffDays < 7) return `${diffDays} dagar sedan`;
  return formatDate(timestamp);
}

/**
 * Format currency value
 */
export function formatCurrency(value, currency = "SEK") {
  if (value == null) return "—";
  const formatted = new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
  if (currency === "SEK") return `${formatted} kr`;
  const symbols = { EUR: "€", USD: "$", GBP: "£" };
  const symbol = symbols[currency] || currency;
  return `${symbol}${formatted}`;
}

/**
 * Generate initials from a name (e.g., "Erik Vandijk" -> "EV")
 */
export function getInitials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 50) {
  if (!text) return "";
  return text.length > maxLength ? text.slice(0, maxLength) + "…" : text;
}
