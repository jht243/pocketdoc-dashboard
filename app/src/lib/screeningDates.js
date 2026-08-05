/**
 * Helpers for screening completion dates.
 *
 * completedItems values:
 *   falsy      → not done
 *   true       → done, month unknown
 *   "YYYY-MM"  → done in that month (stored as YYYY-MM-01 in the DB)
 */

export function isScreeningDone(value) {
  return Boolean(value);
}

export function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Normalize a completedItems value to a DB `date` (YYYY-MM-DD) or null. */
export function toCompletedAt(value) {
  if (!value || value === true) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return `${trimmed.slice(0, 7)}-01`;
  }
  return null;
}

/** Turn a DB completed_at (date/timestamptz) into a completedItems value. */
export function fromCompletedAt(completedAt, urgency) {
  const done = urgency === "done" || !!completedAt;
  if (!done) return false;
  if (!completedAt) return true;
  const raw = String(completedAt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return true;
  return raw.slice(0, 7);
}

export function formatCompletedMonth(value) {
  const iso = toCompletedAt(value);
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export function yearOptions(span = 40) {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= current - span; y -= 1) years.push(y);
  return years;
}
