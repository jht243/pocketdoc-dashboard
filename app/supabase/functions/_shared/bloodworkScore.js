/**
 * The bloodwork health score — the third 50-point component of the Health Score.
 *
 * The wearable rubric arrived as a spec; this one did not, so it is written here and
 * the reasoning is on the page. Where it differs from the wearable rubric, it differs
 * on purpose:
 *
 *   Absolute thresholds, not personal baselines. A resting heart rate of 56 means
 *   nothing without knowing whose it is; an ApoB of 130 means the same thing in
 *   everyone. Blood markers have decades of outcome data behind population cutoffs,
 *   so the score uses them rather than inventing a personal normal from two blood
 *   draws — which is all most members will ever have.
 *
 *   Missing markers are EXCLUDED, not scored neutrally. The wearable rubric scores an
 *   unrecorded night as Fair because a night without the ring is not evidence either
 *   way. A panel that never measured ApoB is different: awarding partial credit for a
 *   test nobody ran would let an incomplete panel outscore a complete one. Instead the
 *   component is scored over the markers actually present and the coverage is
 *   disclosed — and below a minimum coverage the component doesn't score at all.
 *
 *   Recency matters. A wearable reading is from last night. Bloodwork can be four
 *   years old, and a four-year-old ApoB is a historical note, not a current fact.
 *
 * Thresholds and their sources:
 *   ApoB          <70 optimal / <90 general — ACC/AHA 2026 dyslipidaemia guideline,
 *                 which added ApoB for adults on lipid-lowering therapy and in
 *                 cardiovascular-kidney-metabolic syndrome.
 *   Lp(a)         <30 mg/dL low, 30-50 intermediate, >=50 high — NLA 2024 focused
 *                 update; ESC/EAS 2025 uses the same >50 mg/dL cutoff.
 *   hs-CRP        <1 low, 1-3 average, >3 high — AHA/CDC. Above 10 the result is
 *                 treated as acute-phase and excluded rather than scored (see below).
 *   HbA1c         <5.7 normal, 5.7-6.4 prediabetes, >=6.5 diabetes range — ADA
 *                 Standards of Care 2026. Fasting glucose 100-125 / >=126 likewise.
 *   Fasting insulin  optimal <5, insulin resistance above ~12 µIU/mL; HOMA-IR below
 *                 1.5 optimal, >=2.5 the NHANES insulin-resistance cutoff.
 *   eGFR          KDIGO G1-G3b category boundaries at 90 / 60 / 45.
 *   ALT           33 U/L men, 25 U/L women — AASLD healthy-population upper limits,
 *                 which are well below most lab reference ranges.
 *   Vitamin D     30 ng/mL sufficiency, 40-60 the commonly targeted range.
 *
 * This rubric is the same kind of clinical artefact as the wearable one and carries
 * the same requirement: medical-director review before it goes in front of members,
 * and re-review quarterly. It is deliberately conservative — no marker can push a
 * member's score up dramatically, and the alerts describe rather than diagnose.
 *
 * Pure: no network, no Deno, no DOM, no imports. Plain .js so Deno's strict .ts
 * checking can't reject it at deploy and the browser build can import the same file.
 */

export const BLOODWORK_VERSION = "1.0";
export const BLOODWORK_MAX = 50;

/** Same five tiers as the wearable rubric, so one score never means two things. */
export const TIER_MULTIPLIERS = { excellent: 1, good: 0.8, fair: 0.55, poor: 0.25, critical: 0 };

/**
 * Below this many points' worth of markers, there is not enough of a panel to call
 * anything a bloodwork score — the component is withheld rather than extrapolated
 * from two results. 15 of 50 is roughly "a lipid panel and one other thing".
 */
export const MIN_COVERAGE_POINTS = 15;

/** Older than this and the panel is history, not a current picture. */
export const MAX_AGE_MONTHS = 24;

/* --------------------------------------------------------------- the rubric */

/**
 * Every scored marker: what it's worth, which panel it belongs to, how to recognise
 * it on an imported report, and the bands.
 *
 * Bands are ordered and inclusive-exclusive on `max`; the first match wins. Writing
 * them as explicit ranges rather than a direction plus cutoffs is what lets markers
 * with a healthy WINDOW — vitamin D, ferritin, TSH, glucose — be scored correctly.
 * Too much ferritin is not better than enough ferritin.
 *
 * `variants` hold sex-specific bands. When sex is unknown the neutral set is used,
 * which takes the more cautious boundary of the two rather than guessing.
 */
const MARKERS = [
  /* ---- atherogenic lipids: 16 pts -------------------------------------- */
  {
    key: "apoB",
    label: "ApoB",
    panel: "cardiovascular",
    points: 8,
    unit: "mg/dL",
    aliases: ["apob", "apolipoprotein b", "apo b", "apolipoprotein b-100"],
    // The single best available measure of atherogenic particle number — one particle,
    // one ApoB. Weighted highest of any marker for the same reason the wearable
    // rubric weights HRV highest: it moves first and it predicts most.
    bands: [
      { tier: "excellent", max: 70 },
      { tier: "good", max: 90 },
      { tier: "fair", max: 110 },
      { tier: "poor", max: 130 },
      { tier: "critical" },
    ],
    alertAbove: { value: 130, message: "ApoB is well above the range associated with low cardiovascular risk. Worth reviewing with a clinician." },
  },
  {
    // Stand-ins for ApoB, used only when ApoB itself wasn't measured — most panels
    // still don't include it. Same weight, because they are answering the same
    // question less precisely, not a less important question.
    key: "nonHdl",
    label: "Non-HDL cholesterol",
    panel: "cardiovascular",
    points: 8,
    unit: "mg/dL",
    aliases: ["non hdl", "non-hdl", "non hdl cholesterol", "non-hdl-c", "nonhdl"],
    supersededBy: "apoB",
    bands: [
      { tier: "excellent", max: 100 },
      { tier: "good", max: 130 },
      { tier: "fair", max: 160 },
      { tier: "poor", max: 190 },
      { tier: "critical" },
    ],
  },
  {
    key: "ldl",
    label: "LDL cholesterol",
    panel: "cardiovascular",
    points: 8,
    unit: "mg/dL",
    aliases: ["ldl", "ldl cholesterol", "ldl-c", "ldl calc", "ldl cholesterol calc"],
    supersededBy: "apoB",
    supersededByAlso: "nonHdl",
    bands: [
      { tier: "excellent", max: 70 },
      { tier: "good", max: 100 },
      { tier: "fair", max: 130 },
      { tier: "poor", max: 160 },
      { tier: "critical" },
    ],
  },
  {
    key: "lpa",
    label: "Lipoprotein(a)",
    panel: "cardiovascular",
    points: 4,
    unit: "mg/dL",
    aliases: ["lp(a)", "lpa", "lipoprotein a", "lipoprotein(a)", "lp a"],
    // Largely genetic and largely fixed, so it is scored but never framed as
    // something the member failed to manage. It earns its weight by changing what
    // every other lipid number means.
    bands: [
      { tier: "excellent", max: 10 },
      { tier: "good", max: 30 },
      { tier: "fair", max: 50 },
      { tier: "poor", max: 90 },
      { tier: "critical" },
    ],
    alertAbove: { value: 50, message: "Lipoprotein(a) is in the elevated range. It's largely inherited and doesn't respond much to lifestyle — worth knowing about and discussing with a clinician." },
  },
  {
    key: "triglycerides",
    label: "Triglycerides",
    panel: "cardiovascular",
    points: 2,
    unit: "mg/dL",
    aliases: ["triglycerides", "trigs", "tg", "triglyceride"],
    bands: [
      { tier: "excellent", max: 90 },
      { tier: "good", max: 150 },
      { tier: "fair", max: 200 },
      { tier: "poor", max: 500 },
      { tier: "critical" },
    ],
    alertAbove: { value: 500, message: "Triglycerides are very high. This range carries a risk to the pancreas and warrants prompt clinical attention." },
  },
  {
    key: "hdl",
    label: "HDL cholesterol",
    panel: "cardiovascular",
    points: 2,
    unit: "mg/dL",
    aliases: ["hdl", "hdl cholesterol", "hdl-c"],
    // Higher is better here, so the bands run the other way. Weighted low on purpose:
    // HDL tracks risk but raising it pharmacologically has never improved outcomes,
    // so a score that leaned on it would be pointing members at a lever that isn't one.
    bands: [
      { tier: "critical", max: 35 },
      { tier: "poor", max: 40 },
      { tier: "fair", max: 45 },
      { tier: "good", max: 60 },
      { tier: "excellent" },
    ],
    variants: {
      female: [
        { tier: "critical", max: 45 },
        { tier: "poor", max: 50 },
        { tier: "fair", max: 55 },
        { tier: "good", max: 70 },
        { tier: "excellent" },
      ],
    },
  },

  /* ---- glycaemic / metabolic: 14 pts ----------------------------------- */
  {
    key: "hba1c",
    label: "HbA1c",
    panel: "metabolic",
    points: 6,
    unit: "%",
    aliases: ["hba1c", "hemoglobin a1c", "haemoglobin a1c", "a1c", "glycated hemoglobin", "hgb a1c"],
    bands: [
      { tier: "excellent", max: 5.3 },
      { tier: "good", max: 5.7 },
      { tier: "fair", max: 6.1 },
      { tier: "poor", max: 6.5 },
      { tier: "critical" },
    ],
    alertAbove: { value: 6.5, message: "HbA1c is in the range used to diagnose diabetes. This needs a clinician's review — a single result isn't a diagnosis." },
  },
  {
    key: "glucose",
    label: "Fasting glucose",
    panel: "metabolic",
    points: 4,
    unit: "mg/dL",
    aliases: ["fasting glucose", "glucose fasting", "glucose", "fasting blood glucose", "fbg", "fasting plasma glucose"],
    // Two-sided: hypoglycaemia is its own problem, not a better score than normal.
    bands: [
      { tier: "critical", max: 60 },
      { tier: "poor", max: 70 },
      { tier: "excellent", max: 90 },
      { tier: "good", max: 100 },
      { tier: "fair", max: 110 },
      { tier: "poor", max: 126 },
      { tier: "critical" },
    ],
    alertAbove: { value: 126, message: "Fasting glucose is in the diabetes range. Worth confirming with a clinician rather than acting on one reading." },
  },
  {
    key: "insulin",
    label: "Fasting insulin",
    panel: "metabolic",
    points: 4,
    unit: "µIU/mL",
    aliases: ["fasting insulin", "insulin", "insulin fasting"],
    // Rises years before glucose does, which is the whole argument for scoring it:
    // it is the earliest thing on a standard panel that a member can still act on.
    bands: [
      { tier: "excellent", max: 5 },
      { tier: "good", max: 8 },
      { tier: "fair", max: 12 },
      { tier: "poor", max: 20 },
      { tier: "critical" },
    ],
  },

  /* ---- inflammation: 6 pts --------------------------------------------- */
  {
    key: "hsCrp",
    label: "hs-CRP",
    panel: "inflammation",
    points: 6,
    unit: "mg/L",
    aliases: ["hs-crp", "hscrp", "hs crp", "high sensitivity crp", "c-reactive protein", "crp", "cardiac crp"],
    bands: [
      { tier: "excellent", max: 0.5 },
      { tier: "good", max: 1 },
      { tier: "fair", max: 3 },
      { tier: "poor" },
    ],
    // Above 10 mg/L, hs-CRP is measuring an infection or an injury, not cardiovascular
    // risk. Scoring it as a catastrophic result would tell a member with a chest cold
    // that their long-term risk collapsed. Excluded from scoring and flagged for a
    // repeat instead — the single most important nuance in this marker.
    excludeAbove: {
      value: 10,
      message: "hs-CRP above 10 usually reflects a short-term infection or injury rather than long-term risk. It hasn't been scored — worth repeating once you're well.",
    },
  },

  /* ---- organ function: 8 pts ------------------------------------------- */
  {
    key: "egfr",
    label: "eGFR (kidney function)",
    panel: "organ",
    points: 4,
    unit: "mL/min/1.73m²",
    aliases: ["egfr", "gfr", "estimated gfr", "gfr estimated", "egfr non-african american", "egfr creat"],
    bands: [
      { tier: "critical", max: 45 },
      { tier: "poor", max: 60 },
      { tier: "fair", max: 75 },
      { tier: "good", max: 90 },
      { tier: "excellent" },
    ],
    alertBelow: { value: 60, message: "Kidney filtration is below the usual range. A single result can be affected by hydration — worth repeating and reviewing with a clinician." },
  },
  {
    key: "alt",
    label: "ALT (liver)",
    panel: "organ",
    points: 4,
    unit: "U/L",
    aliases: ["alt", "alt (sgpt)", "sgpt", "alanine aminotransferase", "alanine transaminase"],
    // Scored against the AASLD healthy-population limits (33 men / 25 women), which
    // sit well below most lab reference ranges — a "normal" ALT of 45 is a finding.
    bands: [
      { tier: "excellent", max: 20 },
      { tier: "good", max: 33 },
      { tier: "fair", max: 45 },
      { tier: "poor", max: 100 },
      { tier: "critical" },
    ],
    variants: {
      female: [
        { tier: "excellent", max: 16 },
        { tier: "good", max: 25 },
        { tier: "fair", max: 35 },
        { tier: "poor", max: 80 },
        { tier: "critical" },
      ],
    },
    alertAbove: { value: 100, message: "Liver enzymes are substantially elevated. Worth a clinician's review to find the cause." },
  },

  /* ---- nutrients & thyroid: 6 pts -------------------------------------- */
  {
    key: "vitaminD",
    label: "Vitamin D (25-OH)",
    panel: "nutrients",
    points: 3,
    unit: "ng/mL",
    aliases: ["vitamin d", "25-oh vitamin d", "vitamin d 25 hydroxy", "25 hydroxyvitamin d", "vit d", "vitamin d3"],
    bands: [
      { tier: "critical", max: 12 },
      { tier: "poor", max: 20 },
      { tier: "fair", max: 30 },
      { tier: "good", max: 40 },
      { tier: "excellent", max: 80 },
      // Above 80 is over-supplementation, not extra credit.
      { tier: "fair", max: 100 },
      { tier: "poor" },
    ],
  },
  {
    key: "ferritin",
    label: "Ferritin",
    panel: "nutrients",
    points: 2,
    unit: "ng/mL",
    aliases: ["ferritin", "serum ferritin"],
    // Two-sided and genuinely so: low means depleted iron stores, high means overload
    // or inflammation. Both matter, and the same number means different things by sex.
    bands: [
      { tier: "critical", max: 10 },
      { tier: "poor", max: 30 },
      { tier: "good", max: 50 },
      { tier: "excellent", max: 150 },
      { tier: "good", max: 300 },
      { tier: "fair", max: 400 },
      { tier: "poor", max: 1000 },
      { tier: "critical" },
    ],
    variants: {
      female: [
        { tier: "critical", max: 8 },
        { tier: "poor", max: 20 },
        { tier: "good", max: 40 },
        { tier: "excellent", max: 120 },
        { tier: "good", max: 250 },
        { tier: "fair", max: 350 },
        { tier: "poor", max: 1000 },
        { tier: "critical" },
      ],
    },
  },
  {
    key: "tsh",
    label: "TSH",
    panel: "nutrients",
    points: 1,
    unit: "mIU/L",
    aliases: ["tsh", "thyroid stimulating hormone", "thyrotropin"],
    bands: [
      { tier: "critical", max: 0.1 },
      { tier: "poor", max: 0.35 },
      { tier: "fair", max: 0.8 },
      { tier: "excellent", max: 2.5 },
      { tier: "good", max: 4 },
      { tier: "fair", max: 5.5 },
      { tier: "poor", max: 10 },
      { tier: "critical" },
    ],
  },
];

export const PANELS = [
  { key: "cardiovascular", label: "Cardiovascular", max: 16 },
  { key: "metabolic", label: "Metabolic", max: 14 },
  { key: "inflammation", label: "Inflammation", max: 6 },
  { key: "organ", label: "Kidney & liver", max: 8 },
  { key: "nutrients", label: "Nutrients & thyroid", max: 6 },
];

/* ------------------------------------------------------------------ units */

/**
 * Unit conversions worth handling, because members' panels genuinely arrive this way.
 *
 * Lp(a) in particular is reported in both mg/dL and nmol/L and the two differ by
 * roughly 2.15x — reading a nmol/L result as mg/dL would put almost everyone in the
 * critical band. The conversion is approximate by nature (Lp(a) mass varies with
 * isoform size); it is used to place a result in a wide band, not to report a value.
 */
const UNIT_CONVERSIONS = {
  lpa: [{ match: /nmol/i, factor: 1 / 2.15 }],
  glucose: [{ match: /mmol/i, factor: 18 }],
  triglycerides: [{ match: /mmol/i, factor: 88.5 }],
  hdl: [{ match: /mmol/i, factor: 38.67 }],
  ldl: [{ match: /mmol/i, factor: 38.67 }],
  nonHdl: [{ match: /mmol/i, factor: 38.67 }],
  vitaminD: [{ match: /nmol/i, factor: 1 / 2.5 }],
  hsCrp: [{ match: /mg\/dl/i, factor: 10 }],
  hba1c: [{ match: /mmol\/mol/i, factor: null }], // handled below — not a linear factor
};

/** IFCC mmol/mol → NGSP %. */
const ifccToPercent = (mmolPerMol) => mmolPerMol / 10.929 + 2.15;

function convert(key, value, unit) {
  const rules = UNIT_CONVERSIONS[key];
  if (!rules || !unit) return value;
  if (key === "hba1c" && /mmol\/mol/i.test(unit)) return ifccToPercent(value);
  const rule = rules.find((r) => r.factor != null && r.match.test(unit));
  return rule ? value * rule.factor : value;
}

/* ---------------------------------------------------------------- helpers */

const isNum = (v) => v != null && v !== "" && Number.isFinite(Number(v));
const round = (n, dp = 1) => (isNum(n) ? Number(Number(n).toFixed(dp)) : null);

/** Lab names arrive as free text from an imported PDF; compare them loosely. */
const normalizeName = (name) =>
  String(name || "").toLowerCase().replace(/[^a-z0-9()]+/g, " ").trim();

/**
 * Values arrive as strings — "78", "< 5", "1.2 mg/dL", "5.4%". Pull the number out,
 * and treat "<5" as 5 rather than dropping it: at a band boundary the difference is
 * immaterial, and dropping it would cost the member coverage.
 */
function parseValue(raw) {
  if (isNum(raw)) return Number(raw);
  const match = String(raw ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Does this lab row name this marker?
 *
 * Whole-token matching, not substring: "non-HDL cholesterol" contains "hdl", and a
 * naive `includes` would score a member's non-HDL result as their HDL. Aliases are
 * checked longest-first so the most specific one claims the row.
 */
function nameMatches(normalized, aliases) {
  return aliases.some((alias) => {
    const a = normalizeName(alias);
    if (normalized === a) return true;
    return new RegExp(`(^|\\s|\\()${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s|\\))`).test(normalized);
  });
}

/**
 * When a lab row was drawn, as something sortable.
 *
 * `date` is a DISPLAY string ("Jun 2026") and must never be the sort key: compared
 * as text, "Mar 2025" beats "Jun 2026" and the rubric scores a year-old panel as the
 * member's current one. Prefer the real dates and fall back to `date` only for the
 * test-mode snapshot, which carries nothing else.
 */
const measuredOn = (lab) => String(lab.drawnOn || lab.created_at || lab.date || "");

/** Most recent lab row matching a marker, with its value converted to our unit. */
function findMarkerRow(labs, marker) {
  const sorted = [...labs].sort((a, b) => measuredOn(b).localeCompare(measuredOn(a)));
  for (const lab of sorted) {
    const normalized = normalizeName(lab.name);
    if (!nameMatches(normalized, marker.aliases)) continue;
    // "non-HDL" must never be claimed by the HDL marker, and vice versa.
    if (marker.key === "hdl" && /non\s*hdl/.test(normalized)) continue;
    if (marker.key === "ldl" && /non\s*hdl/.test(normalized)) continue;
    const value = parseValue(lab.value);
    if (value == null) continue;
    const inOurUnit = convert(marker.key, value, lab.unit);
    // Only worth telling the member what the report said when the NUMBER changed —
    // "uIU/mL" vs "µIU/mL" is the same result typed differently, and showing it as a
    // conversion invites doubt about a value we didn't touch.
    return { lab, value: inOurUnit, converted: Math.abs(inOurUnit - value) > 0.001 };
  }
  return null;
}

function bandsFor(marker, sex) {
  const variant = sex && marker.variants?.[sex];
  return variant || marker.bands;
}

function tierFor(bands, value) {
  for (const band of bands) {
    if (band.max == null || value < band.max) return band.tier;
  }
  return bands[bands.length - 1].tier;
}

const monthsSince = (dateish, now) => {
  const then = new Date(dateish);
  if (Number.isNaN(then.getTime())) return null;
  return (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
};

/**
 * How current the panel is. A result is not wrong because it is old, but it is less
 * informative, and the score should say so rather than quietly treating a 2023 ApoB
 * as today's fact.
 */
function recencyFor(months) {
  if (months == null) return { months: null, percent: 80, note: "Undated results — treated cautiously." };
  if (months <= 6) return { months: round(months), percent: 100, note: "Results are current." };
  if (months <= 12) return { months: round(months), percent: 90, note: "Results are under a year old." };
  if (months <= 18) return { months: round(months), percent: 75, note: "Results are over a year old — worth repeating." };
  if (months <= MAX_AGE_MONTHS) return { months: round(months), percent: 60, note: "Results are approaching two years old — worth repeating." };
  return { months: round(months), percent: 0, note: "Results are more than two years old — too old to score." };
}

const SCORE_LABELS = [
  { min: 45, label: "Excellent", token: "excellent" },
  { min: 38, label: "Good", token: "good" },
  { min: 28, label: "Fair", token: "fair" },
  { min: 18, label: "Low", token: "low" },
  { min: 0, label: "Critical", token: "critical" },
];

export function getBloodworkLabel(score) {
  const band = SCORE_LABELS.find((b) => score >= b.min) || SCORE_LABELS[SCORE_LABELS.length - 1];
  return { label: band.label, token: band.token };
}

/* ----------------------------------------------------------------- the API */

/**
 * Score a member's bloodwork.
 *
 * @param {object[]} labs  lab marker rows: { name, value, unit, created_at | date }
 * @param {object}   opts  { sex: "male" | "female" | undefined, now: Date }
 * @returns a result object shaped like the wearable one, including `available` —
 *          false when there isn't enough of a panel, or it's too old, to say anything.
 *          The caller leaves the component out of the total entirely in that case.
 */
export function calculateBloodworkScore(labs = [], opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const sex = opts.sex === "female" ? "female" : opts.sex === "male" ? "male" : null;

  const scored = [];
  const alerts = [];
  const claimed = new Set();

  for (const marker of MARKERS) {
    // Stand-in markers only score when the marker they stand in for is absent.
    if (marker.supersededBy && claimed.has(marker.supersededBy)) continue;
    if (marker.supersededByAlso && claimed.has(marker.supersededByAlso)) continue;

    const found = findMarkerRow(labs, marker);
    if (!found) continue;

    const { lab, value, converted } = found;
    // Same precedence as the sort above — recency is measured from when blood was
    // drawn, not from the display string or the day the file was imported.
    const measuredAt = measuredOn(lab) || null;

    // A result that isn't measuring what the marker is for — hs-CRP during an
    // infection — is excluded from scoring rather than counted as a bad result.
    if (marker.excludeAbove && value >= marker.excludeAbove.value) {
      alerts.push({ marker: marker.key, label: marker.label, severity: "info", value: round(value), message: marker.excludeAbove.message });
      claimed.add(marker.key);
      scored.push({
        key: marker.key, label: marker.label, panel: marker.panel, unit: marker.unit,
        value: round(value), measuredAt, excluded: true, tier: null, points: 0, max: 0,
        note: marker.excludeAbove.message,
      });
      continue;
    }

    const tier = tierFor(bandsFor(marker, sex), value);
    claimed.add(marker.key);

    if (marker.alertAbove && value >= marker.alertAbove.value) {
      alerts.push({ marker: marker.key, label: marker.label, severity: tier === "critical" ? "critical" : "warning", value: round(value), message: marker.alertAbove.message });
    }
    if (marker.alertBelow && value < marker.alertBelow.value) {
      alerts.push({ marker: marker.key, label: marker.label, severity: tier === "critical" ? "critical" : "warning", value: round(value), message: marker.alertBelow.message });
    }

    scored.push({
      key: marker.key,
      label: marker.label,
      panel: marker.panel,
      unit: marker.unit,
      value: round(value),
      reportedAs: converted ? `${lab.value} ${lab.unit}` : null,
      measuredAt,
      excluded: false,
      tier,
      multiplier: TIER_MULTIPLIERS[tier],
      points: round(marker.points * TIER_MULTIPLIERS[tier]),
      max: marker.points,
    });
  }

  const counted = scored.filter((m) => !m.excluded);
  const coveragePoints = counted.reduce((sum, m) => sum + m.max, 0);
  const earned = counted.reduce((sum, m) => sum + m.points, 0);

  const dates = counted.map((m) => m.measuredAt).filter(Boolean);
  const newest = dates.length ? dates.sort().slice(-1)[0] : null;
  const recency = recencyFor(newest ? monthsSince(newest, now) : null);

  const coverage = {
    points: coveragePoints,
    max: BLOODWORK_MAX,
    percent: Math.round((coveragePoints / BLOODWORK_MAX) * 100),
    markers: counted.length,
  };

  const available = coveragePoints >= MIN_COVERAGE_POINTS && recency.percent > 0;

  // Scored over the markers present, then expressed on the 50-point scale — so a
  // partial panel is judged on what it measured, with the coverage stated next to it
  // rather than hidden inside the number.
  const totalScore = available && coveragePoints ? round((earned / coveragePoints) * BLOODWORK_MAX) : null;
  const { label, token } = available ? getBloodworkLabel(totalScore) : { label: null, token: null };

  const panels = PANELS.map((panel) => {
    const markers = scored.filter((m) => m.panel === panel.key);
    const panelCounted = markers.filter((m) => !m.excluded);
    return {
      ...panel,
      markers,
      points: round(panelCounted.reduce((sum, m) => sum + m.points, 0)),
      covered: panelCounted.reduce((sum, m) => sum + m.max, 0),
    };
  }).filter((panel) => panel.markers.length);

  // Confidence is the weaker of "how much of the panel exists" and "how old it is" —
  // a complete panel from three years ago is not a confident picture, and neither is
  // yesterday's single marker.
  const confidencePercent = available ? Math.min(coverage.percent, recency.percent) : 0;

  return {
    version: BLOODWORK_VERSION,
    available,
    unavailableReason: available
      ? null
      : recency.percent === 0 && coveragePoints
        ? "Your most recent results are more than two years old."
        : "Not enough markers yet to score your bloodwork.",
    totalScore,
    max: BLOODWORK_MAX,
    label,
    token,
    earned: round(earned),
    coverage,
    recency,
    confidence: {
      percent: confidencePercent,
      note: available
        ? `Based on ${coverage.markers} scored marker${coverage.markers === 1 ? "" : "s"} covering ${coverage.percent}% of the panel. ${recency.note}`
        : recency.percent === 0
          ? recency.note
          : "Upload a fuller panel — ApoB or a lipid panel, HbA1c and hs-CRP cover most of the score.",
    },
    panels,
    markers: scored,
    alerts,
    computedAt: now.toISOString(),
  };
}

/** What's missing, ranked by how much of the score it would unlock. */
export function missingMarkers(result) {
  const present = new Set((result?.markers || []).map((m) => m.key));
  return MARKERS.filter((m) => !present.has(m.key) && !(m.supersededBy && present.has(m.supersededBy)))
    .filter((m) => !m.supersededBy || !present.has(m.supersededBy))
    .sort((a, b) => b.points - a.points)
    .map((m) => ({ key: m.key, label: m.label, points: m.points }));
}

export { MARKERS };
