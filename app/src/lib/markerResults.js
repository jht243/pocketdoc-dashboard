// One lab row, read the way the Biology screen shows it: the lab range the member's
// own report printed, the Thumbprint target that applies to this member, and the
// status between the two. The rules live in scorecard.js and markerTargets.js
// (import-free, so the agents' tests cover them); this file joins them to a row
// and to the theme.
import { COLORS } from "../theme/tokens";
import { markerIdFor, targetFor } from "./markerTargets";
import { markerStatus, parseLabRange, toNumber } from "./scorecard";

/** The range string exactly as the report printed it, or "" when there wasn't one. */
const labRangeOf = (m) => String(m?.range || m?.ref_range || "").trim();

/**
 * @param {object} m        a lab row: name, value, unit, range, drawnOn…
 * @param {object} ctx      { targets, sex, age }
 */
function assessMarker(m, { targets, sex, age }) {
  const markerId = markerIdFor(m?.name);
  const target = targetFor(targets, { markerId, unit: m?.unit, sex, age });
  const labRange = labRangeOf(m);
  const status = markerStatus({ value: m?.value, range: labRange, target });
  return { markerId, target, labRange, hasLabRange: Boolean(parseLabRange(labRange)), status };
}

// Red is reserved for "outside the lab range". Outside the Thumbprint target but
// inside the lab's own range is a reason to look, not an alarm, so it takes the
// theme's amber "watch" colour.
const STATUS_TONE = {
  outside_lab: { fg: COLORS.danger, bg: COLORS.badDim },
  outside_target: { fg: COLORS.gold, bg: COLORS.warnDim },
  within_target: { fg: COLORS.good, bg: COLORS.goodDim },
  within_lab: { fg: COLORS.good, bg: COLORS.goodDim },
  unknown: { fg: COLORS.textMuted, bg: COLORS.neutralDim },
};

const statusTone = (status) => STATUS_TONE[status] || STATUS_TONE.unknown;

/** Local-midnight Date for a row's draw (falling back to import time), or null. */
function drawDateOf(m) {
  const raw = m?.drawnOn ? `${m.drawnOn}T00:00:00` : (m?.created_at || "");
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Jun 2026" — the date a member reads a result by. */
function monthYear(m) {
  const d = drawDateOf(m);
  return d ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : (m?.date || "");
}

/**
 * Oldest-first numeric readings of one marker in the current reading's unit, for
 * the trend chart. A reading in another unit is left out rather than plotted on the
 * wrong scale.
 */
function trendPoints(history, current) {
  const unit = String(current?.unit || "").trim().toLowerCase();
  return (history || [])
    .filter((h) => String(h?.unit || "").trim().toLowerCase() === unit)
    .map((h) => ({ row: h, value: toNumber(h.value), when: drawDateOf(h) }))
    .filter((p) => p.value != null)
    .sort((a, b) => (a.when?.getTime() ?? 0) - (b.when?.getTime() ?? 0));
}

export { assessMarker, statusTone, monthYear, trendPoints, labRangeOf };
