// "What's driving your numbers": the system scorecard on the Biology screen, and
// the per-marker status it is built from.
//
// Adam's Oct 14 build spec. Six systems, each rated in words only — Strong / Fair /
// Needs attention / Not enough data. No years, no percentages, no combined score,
// no weighting: a member should be able to check every rating by eye against the
// marker rows underneath it.
//
// Pure logic with no imports, so the agents' node test runner can exercise it
// directly (agents/test/scorecard.test.mjs).

/* ---------------- per-marker status ---------------- */

const EPS = 1e-9;

/**
 * A lab value as a number. "<0.5" and ">1000" are reported limits: read as just
 * below and just above the printed number, as escalation.mjs reads them, so "<1.0"
 * sits under an "under 1.0" target and ">1000" crosses a 1000 bound.
 */
function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value ?? "").replace(/,/g, "").trim();
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  if (/^[<≤]/.test(s)) return n - EPS;
  if (/^[>≥]/.test(s)) return n + EPS;
  return n;
}

/** The limits printed on the member's own report: "0.57-1.00", "<1.10", ">39". Null when none parse. */
function parseLabRange(range) {
  const text = String(range ?? "").trim();
  if (!text) return null;
  const span = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (span) return { low: Number(span[1]), high: Number(span[2]) };
  const under = text.match(/[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (under) return { low: null, high: Number(under[1]) };
  const over = text.match(/[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (over) return { low: Number(over[1]), high: null };
  return null;
}

/** "within" | "outside" | "unknown" against the lab's own printed range (inclusive). */
function labPosition(value, range) {
  const v = toNumber(value);
  const r = parseLabRange(range);
  if (v == null || !r) return "unknown";
  if (r.high != null && v > r.high) return "outside";
  if (r.low != null && v < r.low) return "outside";
  return "within";
}

/**
 * "within" | "outside" | "none" against a Thumbprint target row.
 *   lower_better   under target_high
 *   higher_better  target_low or above
 *   range          target_low to target_high, inclusive
 */
function targetPosition(value, target) {
  const v = toNumber(value);
  if (v == null || !target) return "none";
  const lo = target.target_low == null ? null : Number(target.target_low);
  const hi = target.target_high == null ? null : Number(target.target_high);
  if (lo == null && hi == null) return "none";
  if (target.direction === "lower_better") return hi != null && v >= hi ? "outside" : (lo != null && v < lo ? "outside" : "within");
  if (target.direction === "higher_better") return lo != null && v < lo ? "outside" : (hi != null && v > hi ? "outside" : "within");
  if (lo != null && v < lo) return "outside";
  if (hi != null && v > hi) return "outside";
  return "within";
}

/**
 * One marker's status, in the order the spec reads it:
 *   outside_lab      outside the range the member's own report printed (the only red)
 *   outside_target   inside the lab range (or none printed) but outside the Thumbprint target
 *   within_target    inside the target
 *   within_lab       no target applies; inside the lab range
 *   unknown          no target applies and no lab range printed, or no number to read
 */
function markerStatus({ value, range, target }) {
  const lab = labPosition(value, range);
  const tgt = targetPosition(value, target);
  if (lab === "outside") return "outside_lab";
  if (tgt === "outside") return "outside_target";
  if (tgt === "within") return "within_target";
  if (lab === "within") return "within_lab";
  return "unknown";
}

const STATUS_LABELS = {
  outside_lab: "Outside lab range",
  outside_target: "Outside target, within lab range",
  within_target: "Within target",
  within_lab: "Within lab range",
  unknown: "No range to compare",
};

/** Label for a status, worded honestly when the report printed no range. */
function statusLabel(status, { hasLabRange = true } = {}) {
  if (status === "outside_target" && !hasLabRange) return "Outside target";
  return STATUS_LABELS[status] || STATUS_LABELS.unknown;
}

/* ---------------- systems ---------------- */

// Marker ids are markerTargets.js's. Blood pressure has no lab target and only
// counts when a reading is on file as a row.
const SYSTEMS = [
  { id: "metabolic", name: "Metabolic", markers: ["FASTING_GLUCOSE", "HBA1C", "FASTING_INSULIN", "TRIGLYCERIDES"] },
  { id: "inflammation", name: "Inflammation", markers: ["HS_CRP", "WBC"] },
  { id: "organ", name: "Organ function", markers: ["ALBUMIN", "CREATININE", "EGFR", "ALT", "AST", "ALP"] },
  { id: "blood", name: "Blood", markers: ["RDW", "MCV", "HEMOGLOBIN"] },
  { id: "nutrients", name: "Nutrients", markers: ["VITAMIN_D_25OH", "FERRITIN", "B12"] },
  { id: "heart", name: "Heart and lipids", markers: ["LDL_C", "APOB", "HDL_C", "BLOOD_PRESSURE"] },
];

/** Plain names for the system markers, used when a marker has no reading on file to borrow a printed name from. */
const MARKER_NAMES = {
  FASTING_GLUCOSE: "Fasting glucose", HBA1C: "A1c", FASTING_INSULIN: "Fasting insulin", TRIGLYCERIDES: "Triglycerides",
  HS_CRP: "hs-CRP", WBC: "White blood cells",
  ALBUMIN: "Albumin", CREATININE: "Creatinine", EGFR: "eGFR", ALT: "ALT", AST: "AST", ALP: "Alkaline phosphatase",
  RDW: "RDW", MCV: "MCV", HEMOGLOBIN: "Hemoglobin",
  VITAMIN_D_25OH: "Vitamin D", FERRITIN: "Ferritin", B12: "Vitamin B12",
  LDL_C: "LDL cholesterol", APOB: "ApoB", HDL_C: "HDL cholesterol", BLOOD_PRESSURE: "Blood pressure",
};

const RATING_LABELS = {
  strong: "Strong",
  fair: "Fair",
  needs_attention: "Needs attention",
  not_enough_data: "Not enough data",
};

/** A marker clears the bar when it is inside its target — or, with no target to judge it by, inside the lab range. */
const clearsBar = (status) => status === "within_target" || status === "within_lab";

/**
 * Rate one system from the statuses of the markers on file.
 *
 * @param {{markers: string[]}} system
 * @param {Object<string,string>} statusById  marker id → markerStatus(); a marker
 *   with no reading on file is simply absent
 *
 * Order of the rules, and why:
 *   1. Any marker outside its lab range → Needs attention, even when the system is
 *      thinly covered. A value the lab itself flagged must never hide behind
 *      "Not enough data".
 *   2. Fewer than half the system's markers on file → Not enough data.
 *   3. Half or more of the on-file markers outside target → Needs attention.
 *   4. Every on-file marker clears the bar → Strong.
 *   5. Anything else → Fair.
 */
function rateSystem(system, statusById = {}) {
  const total = system.markers.length;
  const onFile = system.markers.filter((id) => statusById[id] != null);
  const outsideLab = onFile.filter((id) => statusById[id] === "outside_lab");
  const outsideTarget = onFile.filter((id) => statusById[id] === "outside_target");
  const counts = { total, onFile: onFile.length, outsideLab: outsideLab.length, outsideTarget: outsideTarget.length };

  let rating;
  if (outsideLab.length > 0) rating = "needs_attention";
  else if (onFile.length * 2 < total) rating = "not_enough_data";
  else if (outsideTarget.length * 2 >= onFile.length) rating = "needs_attention";
  else if (onFile.every((id) => clearsBar(statusById[id]))) rating = "strong";
  else rating = "fair";

  return { id: system.id, name: system.name, markers: system.markers, rating, label: RATING_LABELS[rating], ...counts };
}

/** Every system, in display order. */
function rateSystems(statusById = {}, systems = SYSTEMS) {
  return systems.map((s) => rateSystem(s, statusById));
}

export {
  toNumber,
  parseLabRange,
  labPosition,
  targetPosition,
  markerStatus,
  statusLabel,
  STATUS_LABELS,
  SYSTEMS,
  MARKER_NAMES,
  RATING_LABELS,
  rateSystem,
  rateSystems,
};
