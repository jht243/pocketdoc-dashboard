/**
 * Biological age — Levine's Phenotypic Age ("PhenoAge"), from nine routine blood
 * markers and chronological age.
 *
 * Source: Levine ME et al., "An epigenetic biomarker of aging for lifespan and
 * healthspan", Aging 2018;10(4):573-591, Table 1 (Gompertz coefficients), with the
 * equation as corrected in Liu Z et al., PLOS Medicine 2019 (correction published
 * 2019, PMC6388911) — the original Methods text is missing a step and cannot be
 * resolved as printed. Built to Adam's Oct 14 developer spec.
 *
 * Checked against two independent sources before anything here was trusted:
 *   - Table 1 of the paper: every weight matches, except that Table 1 prints
 *     alkaline phosphatase as 0.0019 while the corrected equation (and the spec)
 *     uses 0.00188. 0.00188 is the unrounded value; at a typical ALP of 80 U/L the
 *     two differ by 0.0017 in xb, under 0.02 years of PhenoAge.
 *   - The BioAge R package (dayoonkwon/BioAge, phenoage_calc.R, orig = TRUE) carries
 *     the full-precision weights (-19.90667, -0.03359355, 0.009506491, ...). Its
 *     mortality step uses 1.51714 / 0.007692696, which is exactly
 *     (e^(120γ) - 1) / γ with γ = 0.0076927, and its final step uses 0.0055305 where
 *     the spec rounds to 0.00553 — a difference of 0.001 years. The rounded spec
 *     weights are used here, as written, and reproduce the spec's worked example
 *     (50.1 for the 53-year-old) exactly.
 *
 * What it will and won't do, on purpose:
 *   All nine markers from ONE blood draw, or no number at all. Mixing a 2024 CBC with
 *   a 2026 metabolic panel produces an age that describes no moment in the member's
 *   life, and a partial panel cannot be extrapolated — the model has no defaults.
 *
 *   The coefficients only work in the units the model was fitted in (SI for the
 *   chemistry, CRP in mg/dL logged). US labs report albumin in g/dL, creatinine in
 *   mg/dL, glucose in mg/dL and hs-CRP in mg/L, so every value is converted, and then
 *   checked against a physiologic range in the model's units. A value outside that
 *   range is almost always a unit the lab labelled differently from how we read it —
 *   an albumin "44" that is really g/L read as g/dL would add fifteen years — so the
 *   calculation stops and asks rather than producing a confident wrong number.
 *
 *   hs-CRP above 10 mg/L is an acute-phase reaction (a cold, an injury), not a
 *   reading of chronic inflammation, so the age is withheld and a recheck suggested.
 *   Below the lab's detection limit the limit itself is used: log(0) is undefined
 *   and a "<0.2" is real information that the true value is small.
 *
 *   The model was fitted on NHANES adults 20-84, so outside that range it says
 *   "not available" rather than extrapolate. Pregnancy, active cancer treatment and
 *   acute illness all move these markers for reasons that have nothing to do with
 *   aging, so any of them suppresses the result.
 *
 *   The mortality score M is an intermediate quantity, never returned and never
 *   shown: a "4.7% ten-year mortality" printed in a wellness app is a diagnosis in
 *   all but name.
 *
 * Nothing in this file is in front of members until the medical director signs off;
 * the display sits behind a flag (see src/lib/phenoAge.js).
 *
 * Pure: no network, no Deno, no DOM, no imports. Plain .js, like bloodworkScore.js,
 * so Deno can't reject it at deploy and the browser build imports the same file.
 */

export const PHENOAGE_VERSION = "1.0";

/* ---------------------------------------------------------------- the model */

/**
 * Weights as in the spec (Levine 2018 Table 1, corrected equation). Units are the
 * model's own; see PHENOAGE_MARKERS for how each arrives from a US report.
 */
export const PHENOAGE_COEFFICIENTS = Object.freeze({
  intercept: -19.907,
  albumin: -0.0336, // g/L
  creatinine: 0.0095, // µmol/L
  glucose: 0.1953, // mmol/L
  lnCrp: 0.0954, // ln(mg/dL)
  lymphocytes: -0.012, // %
  mcv: 0.0268, // fL
  rdw: 0.3306, // %
  alp: 0.00188, // U/L
  wbc: 0.0554, // 1000 cells/µL
  age: 0.0804, // years
});

export const PHENOAGE_GAMMA = 0.0076927;

/** The model was fitted on NHANES adults in this range (85+ was top-coded). */
export const PHENOAGE_AGE_RANGE = Object.freeze({ min: 20, max: 84 });

/** Past this many years younger than actual age, the number is replaced by a phrase. */
export const CAP_YEARS_YOUNGER = 10;

/** hs-CRP at or above this (mg/L) is acute-phase, not chronic inflammation. */
export const CRP_ACUTE_MG_L = 10;

/** Used when a below-detection CRP arrives without a stated limit. */
export const DEFAULT_CRP_LOWER_LIMIT_MG_L = 0.2;

/**
 * The improvement simulator's levers and their targets.
 *
 * Only fasting glucose and hs-CRP: both are lifestyle-modifiable and both were
 * approved as levers in the spec. Signed off by Dr. Locker in Oct 2026; while
 * `approved` is false the display labels the targets as placeholders. They are US
 * units, as a member reads them on their report.
 */
export const SIMULATOR_TARGETS = Object.freeze({
  approved: true,
  approvedBy: "Adam Locker, Oct 2026",
  glucose: Object.freeze({ value: 85, unit: "mg/dL" }),
  crp: Object.freeze({ value: 1.0, unit: "mg/L" }),
});

/**
 * Raw PhenoAge from inputs ALREADY in the model's units. No validation, no rounding —
 * this is the formula and nothing else, kept separate so it can be tested on its
 * own. Callers outside this file want `calculatePhenoAge`.
 *
 * @param {{albumin:number, creatinine:number, glucose:number, crpMgDl:number,
 *   lymphocytes:number, mcv:number, rdw:number, alp:number, wbc:number, age:number}} x
 * @returns {number} PhenoAge in years (NaN/Infinity only for inputs the validator rejects)
 */
export function phenoAgeFormula(x) {
  const c = PHENOAGE_COEFFICIENTS;
  const xb = c.intercept
    + c.albumin * x.albumin
    + c.creatinine * x.creatinine
    + c.glucose * x.glucose
    + c.lnCrp * Math.log(x.crpMgDl)
    + c.lymphocytes * x.lymphocytes
    + c.mcv * x.mcv
    + c.rdw * x.rdw
    + c.alp * x.alp
    + c.wbc * x.wbc
    + c.age * x.age;
  const g = PHENOAGE_GAMMA;
  const m = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * g) - 1) / g);
  return 141.50225 + Math.log(-0.00553 * Math.log(1 - m)) / 0.090165;
}

/* --------------------------------------------------------------- the markers */

/**
 * The nine markers: how to recognise each on an imported report, how to convert it,
 * and the physiologic range (in the model's units) outside which we ask instead of
 * calculating.
 *
 * `units` are tried in order against the row's normalised unit; the first match
 * gives the factor into the model's unit (CRP converts to mg/L first so the acute
 * and detection-limit rules can be written in the unit members see, then to mg/dL
 * for the formula). A row with NO unit is read in the US unit, which is what the
 * app's labs nearly always are — and if that guess is wrong, the range check
 * catches it, because the US and SI values differ by 10x, 18x or 88x.
 *
 * `rejectUnits` are units that mean a DIFFERENT measurement under the same name:
 * absolute lymphocytes (a count) under "Lymphocytes", RDW-SD (fL) under "RDW", an
 * electrophoresis albumin fraction (%) under "Albumin".
 *
 * `excludes` are names that share a whole word with the marker but are another test.
 * "Albumin/Creatinine Ratio" contains both "albumin" and "creatinine"; "Leukocyte
 * esterase" is a urine dipstick, not a white count.
 */
const URINE = ["urine", "urinary", "ur ", "csf", "fluid"];

export const PHENOAGE_MARKERS = Object.freeze([
  {
    key: "albumin",
    label: "Albumin",
    test: "CMP",
    usUnit: "g/dL",
    modelUnit: "g/L",
    aliases: ["albumin", "albumin serum", "serum albumin", "alb"],
    excludes: [...URINE, "microalbumin", "ratio", "globulin", "a g", "prealbumin", "creatinine", "electrophoresis", "fraction"],
    rejectUnits: [/%/, /mg\//],
    units: [{ match: /g\/dl/, factor: 10 }, { match: /g\/l/, factor: 1 }],
    defaultFactor: 10,
    range: [20, 60],
  },
  {
    key: "creatinine",
    label: "Creatinine",
    test: "CMP",
    usUnit: "mg/dL",
    modelUnit: "µmol/L",
    aliases: ["creatinine", "creatinine serum", "serum creatinine", "creat", "creatinine blood"],
    excludes: [...URINE, "ratio", "clearance", "egfr", "gfr", "albumin", "bun", "cystatin", "kinase"],
    units: [{ match: /mg\/dl/, factor: 88.4 }, { match: /umol\/l/, factor: 1 }, { match: /mmol\/l/, factor: 1000 }],
    defaultFactor: 88.4,
    // 0.25-11 mg/dL. Wider than any healthy range: this is a unit check, not a
    // judgment of kidney function.
    range: [20, 1000],
  },
  {
    key: "glucose",
    label: "Fasting glucose",
    test: "CMP",
    usUnit: "mg/dL",
    modelUnit: "mmol/L",
    aliases: [
      "glucose", "glucose fasting", "fasting glucose", "glucose serum", "glucose plasma",
      "fasting blood glucose", "fasting plasma glucose", "fbg", "fpg", "glucose random", "random glucose",
      "blood glucose", "plasma glucose", "serum glucose",
    ],
    // Every one of these is a glucose measured under a different protocol — after a
    // drink, an average over months, a urine strip — and would mean nothing here.
    excludes: [
      ...URINE, "average", "eag", "tolerance", "gtt", "ogtt", "challenge", "post", "2 hour", "2hr", "1 hour",
      "1hr", "hour", "6 phosphate", "g6pd", "a1c", "hemoglobin", "insulin", "ratio",
    ],
    units: [{ match: /mg\/dl/, factor: 1 / 18.018 }, { match: /mmol\/l/, factor: 1 }],
    defaultFactor: 1 / 18.018,
    range: [2.5, 30], // 45-540 mg/dL
  },
  {
    key: "crp",
    label: "hs-CRP",
    test: "hs-CRP",
    usUnit: "mg/L",
    modelUnit: "mg/L", // converted to ln(mg/dL) at the formula, see calculatePhenoAge
    aliases: [
      "hs crp", "hscrp", "high sensitivity crp", "high sensitivity c reactive protein",
      "c reactive protein", "crp", "cardiac crp", "c reactive protein cardiac", "crp cardiac",
      "c reactive protein high sensitivity", "crp high sensitivity", "hs c reactive protein",
    ],
    excludes: [...URINE],
    units: [{ match: /mg\/dl/, factor: 10 }, { match: /mg\/l/, factor: 1 }, { match: /nmol\/l/, factor: 1 / 9.524 }],
    defaultFactor: 1,
    // No sanity floor beyond > 0: the acute (>=10) and detection-limit rules do the
    // work. The ceiling catches a mg/dL value read as mg/L the other way round only
    // when wildly off; anything 10-500 is reported as acute.
    range: [0, 500],
  },
  {
    key: "lymphocytes",
    label: "Lymphocytes (%)",
    test: "CBC with differential",
    usUnit: "%",
    modelUnit: "%",
    aliases: [
      "lymphocytes", "lymphocyte", "lymphs", "lymph", "lymphocytes percent", "lymphocyte percent",
      "lymphocyte percentage", "lymphocytes %", "lymph %", "lym %", "lym",
    ],
    excludes: ["absolute", "abs", "atypical", "reactive", "variant", "count", "#", "subset", "cd4", "cd8", "cd3", ...URINE],
    // A count (cells/µL, K/µL, x10E3/uL) is the absolute lymphocyte number, not the %.
    rejectUnits: [/\//, /10/, /cells/, /^k/, /thou/],
    units: [{ match: /%|percent/, factor: 1 }],
    defaultFactor: 1,
    range: [3, 80],
  },
  {
    key: "mcv",
    label: "MCV",
    test: "CBC with differential",
    usUnit: "fL",
    modelUnit: "fL",
    aliases: ["mcv", "mean corpuscular volume", "mean cell volume", "mean corpuscular vol"],
    excludes: [...URINE, "platelet", "mpv"],
    units: [{ match: /fl|um3/, factor: 1 }],
    defaultFactor: 1,
    range: [50, 150],
  },
  {
    key: "rdw",
    label: "RDW",
    test: "CBC with differential",
    usUnit: "%",
    modelUnit: "%",
    aliases: ["rdw", "rdw cv", "rdwcv", "red cell distribution width", "red blood cell distribution width", "rbc distribution width", "red cell dist width"],
    // RDW-SD is a different measurement in fL (~40); the model was fitted on RDW-CV (%).
    excludes: [...URINE, "sd"],
    rejectUnits: [/fl/],
    units: [{ match: /%|percent/, factor: 1 }],
    defaultFactor: 1,
    range: [8, 30],
  },
  {
    key: "alp",
    label: "Alkaline phosphatase",
    test: "CMP",
    usUnit: "U/L",
    modelUnit: "U/L",
    aliases: [
      "alkaline phosphatase", "alk phos", "alkp", "alp", "alkaline phosphatase total",
      "phosphatase alkaline", "alkaline phosphatase serum", "alk phosphatase",
    ],
    excludes: [...URINE, "bone", "isoenzyme", "isoenzymes", "liver fraction", "placental", "intestinal"],
    units: [{ match: /ukat\/l/, factor: 60 }, { match: /u\/l|iu\/l/, factor: 1 }],
    defaultFactor: 1,
    range: [10, 1000],
  },
  {
    key: "wbc",
    label: "White blood cells",
    test: "CBC with differential",
    usUnit: "K/µL",
    modelUnit: "1000 cells/µL",
    aliases: [
      "wbc", "wbc count", "white blood cell count", "white blood cells", "white blood cell",
      "white cell count", "leukocytes", "leukocyte count", "white count", "total wbc",
    ],
    excludes: [...URINE, "esterase", "casts", "clumps", "hpf", "stool"],
    // K/µL, 10^3/µL, x10E3/uL, 10*3/uL, 10^9/L, thou/uL, /nL are all the same number.
    // A bare cells/µL (6,400) is a thousand times larger.
    units: [
      { match: /(10\^?\*?e?3|x10e3|10e3|k\/|thou|10\^?\*?e?9|x10e9|10e9|\/nl|giga)/, factor: 1 },
      { match: /(cells\/ul|^\/ul$|^\/mm3$|cells\/mm3)/, factor: 1 / 1000 },
    ],
    defaultFactor: 1,
    range: [1, 30],
  },
]);

const MARKER_BY_KEY = Object.fromEntries(PHENOAGE_MARKERS.map((m) => [m.key, m]));

/* ---------------------------------------------------------------- helpers */

/** Lab names arrive as free text from an imported PDF; compare them loosely. */
const normalizeName = (name) =>
  String(name || "").toLowerCase().replace(/[^a-z0-9()%#]+/g, " ").replace(/\s+/g, " ").trim();

/** Units too: "µmol/L", "umol/L", "μmol / l" and "UMOL/L" are one unit. */
const normalizeUnit = (unit) =>
  String(unit || "").toLowerCase().replace(/[µμ]/g, "u").replace(/\s+/g, "").replace(/mcl/g, "ul").trim();

/**
 * Whole-token alias match, as in the bloodwork scorer: a substring match would let
 * "Prealbumin" answer to "albumin" and "MCHC" to... nothing here, but the habit is
 * what stops the next marker being misread.
 */
function nameMatches(normalized, aliases) {
  return aliases.some((alias) => {
    const a = normalizeName(alias);
    if (!a) return false;
    if (normalized === a) return true;
    const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|\\s|\\()${escaped}($|\\s|\\)|%)`).test(normalized);
  });
}

function isExcluded(normalized, excludes) {
  const padded = ` ${normalized} `;
  return excludes.some((x) => {
    const e = normalizeName(x);
    // Short excludes ("sd", "abs", "ur") must be whole words or "absolute" would be
    // excluded by "abs" — fine — but "rdw" would be excluded by "sd" only as a token.
    return e.length <= 3 ? padded.includes(` ${e} `) || padded.includes(`(${e})`) || padded.includes(`${e}#`) : normalized.includes(e);
  });
}

/**
 * "6.4", "<0.2", "< 0.20 mg/L", "13.6 H", "1,200". The number, plus whether the lab
 * reported it as below (or above) its own reporting limit.
 */
function parseValue(raw) {
  if (raw != null && raw !== "" && Number.isFinite(Number(raw))) return { value: Number(raw), below: false, above: false };
  const text = String(raw ?? "").replace(/,/g, "").trim();
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  return { value: Number(match[0]), below: /^\s*(<|less than|below)/i.test(text), above: /^\s*(>|greater than|above)/i.test(text) };
}

const round1 = (n) => Math.round(n * 10) / 10;

/** Nearest half year — the precision the spec allows on screen. */
export function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

/** "50", "49.5". Never more precision than a half year. */
export function formatYears(n) {
  const r = roundToHalf(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** "about 1 year", "about 2.5 years". */
export function aboutYears(n) {
  const r = roundToHalf(n);
  return `about ${formatYears(r)} ${r === 1 ? "year" : "years"}`;
}

/* ------------------------------------------------------ unit conversion */

/**
 * One marker value, from whatever the report said into the model's unit.
 *
 * @returns {{value:number, unitRead:string, converted:boolean, below:boolean} | {error:string}}
 */
export function toModelUnits(key, raw, unit) {
  const marker = MARKER_BY_KEY[key];
  if (!marker) return { error: "unknown-marker" };
  const parsed = typeof raw === "object" && raw !== null ? parseValue(raw.value) : parseValue(raw);
  if (!parsed) return { error: "no-value" };
  const u = normalizeUnit(unit);
  if (u && marker.rejectUnits?.some((r) => r.test(u))) return { error: "wrong-measurement" };
  const rule = u ? marker.units.find((r) => r.match.test(u)) : null;
  const factor = rule ? rule.factor : marker.defaultFactor;
  return {
    value: parsed.value * factor,
    unitRead: rule ? unit : marker.usUnit,
    converted: Math.abs(factor - 1) > 1e-9,
    below: parsed.below,
  };
}

/* ------------------------------------------------- the validated calculator */

const TEST_ORDER = ["CBC with differential", "hs-CRP", "CMP"];

/** "Add a CBC with differential and an hs-CRP to see your biological age." */
export function missingTestsMessage(tests) {
  const named = tests.map((t) => (t === "hs-CRP" ? "an hs-CRP" : t === "CMP" ? "a CMP (metabolic panel)" : `a ${t}`));
  const list = named.length <= 1 ? named.join("")
    : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;
  return `Add ${list} to see your biological age.`;
}

/**
 * The calculator, with every rule from the spec applied. This is the one entry point
 * for a number a member could see.
 *
 * @param {object} input  `age` in years at the draw, plus each marker as a number in
 *   the US unit or `{ value, unit }` (value may be a string like "<0.2").
 * @param {object} [opts]
 * @param {boolean} [opts.fasting]  true = known fasting; false = known not; omitted = unknown
 * @param {{pregnant?:boolean, cancerTreatment?:boolean, acuteIllness?:boolean}} [opts.flags]
 * @param {number} [opts.crpLowerLimit]  the lab's lower reporting limit for hs-CRP, mg/L
 * @param {boolean} [opts.crpIsHighSensitivity]  false when the row was a standard CRP
 * @returns {object} `{ status: "ok", phenoAge, display, age, gap, confidence, notes, inputs }`
 *   or `{ status: "missing" | "confirm" | "recheck" | "unavailable" | "suppressed", message, ... }`
 */
export function calculatePhenoAge(input = {}, opts = {}) {
  const flags = opts.flags || {};
  // Each of these moves the markers for reasons unrelated to aging; a number
  // produced through one of them would be read as a verdict on the member.
  if (flags.pregnant) return { status: "suppressed", reason: "pregnancy", message: "Biological age isn't calculated during pregnancy, when these blood markers change for reasons unrelated to aging." };
  if (flags.cancerTreatment) return { status: "suppressed", reason: "cancer-treatment", message: "Biological age isn't calculated during active cancer treatment, which changes these blood markers directly." };
  if (flags.acuteIllness) return { status: "suppressed", reason: "acute-illness", message: "Biological age isn't calculated from a draw taken during an acute illness. A draw once you've recovered will give a fair reading." };

  const age = input.age == null || input.age === "" ? NaN : Number(input.age);
  const hasAge = Number.isFinite(age);
  if (hasAge && (age < PHENOAGE_AGE_RANGE.min || age > PHENOAGE_AGE_RANGE.max)) {
    return { status: "unavailable", reason: "age-range", message: `Biological age is not available outside ages ${PHENOAGE_AGE_RANGE.min}–${PHENOAGE_AGE_RANGE.max}, the range the research model was built on.` };
  }

  // All nine, or nothing — and say which test would complete the set.
  const missing = PHENOAGE_MARKERS.filter((m) => {
    const v = input[m.key];
    return v == null || v === "" || (typeof v === "object" && (v.value == null || v.value === ""));
  });
  if (missing.length) {
    const tests = [...new Set(missing.map((m) => m.test))].sort((a, b) => TEST_ORDER.indexOf(a) - TEST_ORDER.indexOf(b));
    return { status: "missing", missing: missing.map((m) => m.key), tests, message: missingTestsMessage(tests) };
  }
  // Checked after the markers: a member missing both a test and a birth date is
  // better served by hearing about the test, which is the harder thing to fix.
  if (!hasAge) {
    return { status: "unavailable", reason: "no-age", message: "Add your date of birth to see your biological age." };
  }

  const values = {};
  const problems = [];
  const notes = [];
  let confidence = "standard";
  let crpBelow = false;
  for (const m of PHENOAGE_MARKERS) {
    const raw = input[m.key];
    const unit = typeof raw === "object" ? raw.unit : undefined;
    const r = toModelUnits(m.key, raw, unit);
    if (r.error) {
      problems.push({ key: m.key, label: m.label, value: typeof raw === "object" ? raw.value : raw, unit: unit || null, issue: r.error });
      continue;
    }
    if (m.key === "crp") crpBelow = r.below;
    values[m.key] = r.value;
  }

  // hs-CRP below the lab's detection limit: use the limit, never log(0).
  if (values.crp != null) {
    if (crpBelow || values.crp <= 0) {
      const limit = Number(opts.crpLowerLimit) > 0 ? Number(opts.crpLowerLimit)
        : values.crp > 0 ? values.crp
        : DEFAULT_CRP_LOWER_LIMIT_MG_L;
      values.crp = limit;
      notes.push(`hs-CRP was below the lab's detection limit, so the limit (${limit} mg/L) was used.`);
      // A standard CRP's floor (often 3-5 mg/L) is far above a healthy hs-CRP, and
      // using it would add years. Still calculated, but marked.
      if (limit > 1) {
        confidence = "low";
        notes.push("That detection limit is high for an hs-CRP — a high-sensitivity CRP would make this estimate more accurate.");
      }
    } else if (opts.crpIsHighSensitivity === false && values.crp < 3) {
      notes.push("This used a standard CRP; an hs-CRP is the test the model was built on.");
    }
  }

  // Physiologic ranges in the model's units. Outside them is almost always a unit
  // read wrongly, so ask — never calculate through it.
  for (const m of PHENOAGE_MARKERS) {
    const v = values[m.key];
    if (v == null) continue;
    const [lo, hi] = m.range;
    if (v < lo || v > hi || (m.key === "crp" && !(v > 0))) {
      const raw = input[m.key];
      problems.push({
        key: m.key, label: m.label,
        value: typeof raw === "object" ? raw.value : raw,
        unit: (typeof raw === "object" && raw.unit) || null,
        issue: "out-of-range",
      });
    }
  }
  if (problems.length) {
    const names = problems.map((p) => p.label).join(", ");
    return {
      status: "confirm",
      problems,
      message: `Please confirm the ${names} value${problems.length > 1 ? "s" : ""} and unit${problems.length > 1 ? "s" : ""} on your report — ${problems.length > 1 ? "they look" : "it looks"} outside the expected range, which usually means a unit mix-up.`,
    };
  }

  if (values.crp >= CRP_ACUTE_MG_L) {
    return {
      status: "recheck",
      reason: "crp-acute",
      message: "Your hs-CRP was above 10 mg/L, which usually reflects a recent infection or injury rather than your long-term picture. A recheck in 2–3 weeks will give a fair biological age.",
    };
  }

  if (opts.fasting !== true) {
    confidence = "low";
    notes.push(opts.fasting === false
      ? "This glucose wasn't fasting, which reads high and can make the estimate older than it should be."
      : "We couldn't confirm this draw was fasting. A non-fasting glucose reads high and can make the estimate older than it should be.");
  }

  const inputs = {
    albumin: values.albumin,
    creatinine: values.creatinine,
    glucose: values.glucose,
    crpMgDl: values.crp / 10,
    lymphocytes: values.lymphocytes,
    mcv: values.mcv,
    rdw: values.rdw,
    alp: values.alp,
    wbc: values.wbc,
    age,
  };
  const raw = phenoAgeFormula(inputs);
  if (!Number.isFinite(raw)) {
    return { status: "unavailable", reason: "not-finite", message: "Biological age couldn't be calculated from this draw." };
  }
  const phenoAge = round1(raw);
  const gap = round1(phenoAge - age);
  return {
    status: "ok",
    phenoAge,
    display: formatYears(phenoAge),
    // The model returns very low numbers for very healthy young adults (a healthy
    // 25-year-old comes out near 11). Past 10 years younger, the member sees that
    // phrase instead of the number (decided Oct 18 2026).
    capped: gap < -CAP_YEARS_YOUNGER,
    headline: gap < -CAP_YEARS_YOUNGER ? `More than ${CAP_YEARS_YOUNGER} years younger than your age` : null,
    age,
    gap,
    confidence,
    notes,
    inputs,
    version: PHENOAGE_VERSION,
  };
}

/* ------------------------------------------------------------- simulator */

/**
 * One what-if: the same draw with glucose and/or hs-CRP replaced, the full formula
 * rerun, and the difference. Values in US units (glucose mg/dL, hs-CRP mg/L).
 *
 * @param {object} result  an "ok" result from calculatePhenoAge
 * @param {{glucose?:number, crp?:number}} changes
 */
export function simulateScenario(result, changes = {}) {
  if (!result || result.status !== "ok") return null;
  const next = { ...result.inputs };
  if (changes.glucose != null) next.glucose = Number(changes.glucose) / 18.018;
  // A what-if of "zero CRP" has no logarithm; nothing real reads below 0.01 mg/L.
  if (changes.crp != null) next.crpMgDl = Math.max(Number(changes.crp), 0.01) / 10;
  const phenoAge = round1(phenoAgeFormula(next));
  const improvement = round1(result.phenoAge - phenoAge);
  return { phenoAge, improvement, effect: improvementLabel(improvement) };
}

/** Rounded to the half year; under half a year is called what it is. */
export function improvementLabel(improvement) {
  if (!(improvement >= 0.5)) return "small effect";
  return `${aboutYears(improvement)} younger`;
}

/** Current lever values in the member's units, from a result's model-unit inputs. */
function currentLevers(result) {
  return {
    glucose: Math.round(result.inputs.glucose * 18.018),
    crp: round1(result.inputs.crpMgDl * 10),
  };
}

/**
 * The simulator: each approved lever moved to its target on its own, then both
 * together (computed directly — the effects are not additive through the
 * exponentials). A lever already at or below its target isn't offered.
 *
 * @returns {{levers: Array, combined: object|null, targets: object}}
 */
export function simulateLevers(result, targets = SIMULATOR_TARGETS) {
  if (!result || result.status !== "ok") return { levers: [], combined: null, targets };
  const now = currentLevers(result);
  const defs = [
    { key: "glucose", label: "Fasting glucose", unit: "mg/dL", current: now.glucose, target: targets.glucose.value },
    { key: "crp", label: "hs-CRP", unit: "mg/L", current: now.crp, target: targets.crp.value },
  ];
  const levers = defs.map((d) => {
    if (!(d.current > d.target)) return { ...d, applicable: false, note: "Already at or below the target" };
    const s = simulateScenario(result, { [d.key]: d.target });
    return { ...d, applicable: true, ...s };
  }).sort((a, b) => (b.improvement || 0) - (a.improvement || 0));
  const active = levers.filter((l) => l.applicable);
  const combined = active.length > 1
    ? simulateScenario(result, Object.fromEntries(active.map((l) => [l.key, l.target])))
    : null;
  return { levers, combined, targets };
}

/* --------------------------------------------- from the member's lab rows */

/** When this row's blood was drawn, as a sortable key — same precedence as the rest of the app. */
const drawKeyOf = (lab) => String(lab?.drawnOn || String(lab?.created_at || "").slice(0, 10) || lab?.date || "");

/** "2026-03-04" → local midnight; "Jan 2026" → whatever Date makes of it. */
function parseDrawDate(key) {
  if (!key) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(key) ? new Date(`${key}T00:00:00`) : new Date(key);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Completed years on the draw date. Whole years, as NHANES recorded them when the
 * model was fitted and as every published calculator takes them, so a clinician
 * checking our number by hand gets the same answer.
 */
export function ageOnDate(dob, date) {
  const birth = parseDrawDate(String(dob || "").slice(0, 10));
  if (!birth || !date) return null;
  let age = date.getFullYear() - birth.getFullYear();
  const beforeBirthday = date.getMonth() < birth.getMonth()
    || (date.getMonth() === birth.getMonth() && date.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/** Which of the nine markers this row is, if any. */
export function markerForRow(row) {
  const normalized = normalizeName(row?.name);
  if (!normalized) return null;
  for (const m of PHENOAGE_MARKERS) {
    if (nameMatches(normalized, m.aliases) && !isExcluded(normalized, m.excludes)) return m.key;
  }
  return null;
}

/** Fasting status as the report states it in the glucose row's name. */
function fastingFromName(name) {
  const n = normalizeName(name);
  if (/non fasting|nonfasting|random|not fasting/.test(n)) return false;
  if (/fasting|\bfbg\b|\bfpg\b/.test(n)) return true;
  return undefined;
}

/**
 * The member's lab rows, grouped into blood draws, with the nine markers picked out
 * of each. Newest draw first.
 *
 * Within one draw, a row in the right unit beats one in a unit that means a
 * different measurement (Lymphocytes % beats Lymphocytes K/µL).
 */
export function groupDraws(labs = []) {
  const draws = new Map();
  for (const row of labs || []) {
    const key = markerForRow(row);
    if (!key) continue;
    const parsed = parseValue(row.value);
    if (!parsed) continue;
    const drawKey = drawKeyOf(row);
    if (!draws.has(drawKey)) draws.set(drawKey, { key: drawKey, date: parseDrawDate(drawKey), rows: {} });
    const draw = draws.get(drawKey);
    const held = draw.rows[key];
    const usable = !toModelUnits(key, row.value, row.unit).error;
    const heldUsable = held && !toModelUnits(key, held.value, held.unit).error;
    if (!held || (usable && !heldUsable)) draw.rows[key] = row;
  }
  return [...draws.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/** One draw through the calculator. */
function calculateDraw(draw, { dob, flags } = {}) {
  const input = { age: draw.date ? ageOnDate(dob, draw.date) : null };
  for (const m of PHENOAGE_MARKERS) {
    const row = draw.rows[m.key];
    if (row) input[m.key] = { value: row.value, unit: row.unit };
  }
  const crpRow = draw.rows.crp;
  const crpName = normalizeName(crpRow?.name);
  const result = calculatePhenoAge(input, {
    flags,
    fasting: draw.rows.glucose ? fastingFromName(draw.rows.glucose.name) : undefined,
    crpIsHighSensitivity: crpRow ? /hs|high sensitivity|cardiac/.test(crpName) : undefined,
  });
  if (result.status === "unavailable" && result.reason === "no-age" && dob) {
    return { ...result, message: "This draw has no date on file, so your age at the time can't be worked out." };
  }
  return result;
}

/** Changes smaller than this between draws are within normal lab-to-lab variation. */
export const TREND_NOISE_YEARS = 1;

/**
 * Everything the display needs, from the member's lab rows and date of birth.
 *
 * The number comes from the newest COMPLETE draw — never a newer partial one topped
 * up from older results. When nothing is complete, the draw closest to complete says
 * which test is missing.
 *
 * Trend compares the GAP (biological minus chronological age) between the two
 * newest complete draws, not the raw ages: two years between draws adds two years
 * of PhenoAge to anyone, and that is not news.
 *
 * @returns {{status:string, message?:string, latest?:object, draw?:object,
 *   trend?:object|null, history?:Array, simulator?:object}}
 */
export function bioAgeFromLabs(labs = [], { dob = null, flags = {} } = {}) {
  const draws = groupDraws(labs);
  if (!draws.length) {
    return { status: "missing", message: missingTestsMessage(["CBC with differential", "hs-CRP", "CMP"]), tests: ["CBC with differential", "hs-CRP", "CMP"] };
  }
  const complete = draws.filter((d) => PHENOAGE_MARKERS.every((m) => d.rows[m.key]));
  if (!complete.length) {
    // Closest to complete, newest on a tie.
    const best = [...draws].sort((a, b) => Object.keys(b.rows).length - Object.keys(a.rows).length)[0];
    return { ...calculateDraw(best, { dob, flags }), draw: { key: best.key, date: best.date } };
  }
  if (!dob) {
    return { status: "unavailable", reason: "no-age", message: "Add your date of birth to see your biological age." };
  }

  const results = complete.map((d) => ({ draw: d, result: calculateDraw(d, { dob, flags }) }));
  const latest = results[0];
  const okHistory = results.filter((r) => r.result.status === "ok");
  if (latest.result.status !== "ok") {
    return { ...latest.result, draw: { key: latest.draw.key, date: latest.draw.date } };
  }

  let trend = null;
  if (okHistory.length >= 2) {
    const prev = okHistory[1];
    const change = round1(latest.result.gap - prev.result.gap);
    trend = {
      since: prev.draw.date,
      sinceKey: prev.draw.key,
      change,
      direction: Math.abs(change) < TREND_NOISE_YEARS ? "steady" : change < 0 ? "younger" : "older",
    };
  }

  return {
    status: "ok",
    latest: latest.result,
    draw: { key: latest.draw.key, date: latest.draw.date },
    trend,
    history: okHistory.map((r) => ({ key: r.draw.key, date: r.draw.date, phenoAge: r.result.phenoAge, age: r.result.age, gap: r.result.gap })),
    simulator: simulateLevers(latest.result),
  };
}
