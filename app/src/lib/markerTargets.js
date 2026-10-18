// Thumbprint targets: the second reference point shown next to every lab range.
//
// Adam's Oct 14 build spec: each marker shows the lab range exactly as the member's
// own report printed it, and beside it a Thumbprint target. The targets are data,
// not code — they live in ghai.marker_targets (migration 20261018_marker_targets.sql)
// so the medical director can approve or revise them without a release. This file
// is the bundled copy of the same seed, so the Biology screen still has targets
// before the migration is applied, offline, or when the table read fails. The
// screen prefers the table whenever it loads.
//
// Every row is a placeholder: approved_by is 'pending' until Dr. Locker signs off.
// Values are deliberately conservative and guideline-based — where no guideline
// sets a target, the row says so and carries the Emerging label rather than
// presenting a convention as settled science.
//
// Bound semantics (the table uses the same):
//   lower_better   value must be UNDER target_high          ("Under 100")
//   higher_better  value must be AT OR ABOVE target_low      ("40 or above")
//   range          target_low <= value <= target_high        ("70–99")
//
// Marker ids are the escalation matrix's ids (agents/library/escalation.json)
// upper-cased — FASTING_GLUCOSE, HBA1C, HS_CRP, VITAMIN_D_25OH, LPA… — so a row
// the agents route as `hs_crp` is the row shown here as HS_CRP. Two exceptions
// follow the spec's own example: LDL_C and HDL_C (the matrix's `hdl`).
//
// No imports on purpose: the agents' test runner (plain node) imports this file
// to check the bundled seed and the migration agree.

const PENDING = { approved_by: "pending", approved_date: null, version: 1 };
const ANY = { sex: "any" };

const MARKER_TARGETS = [
  // ---------------- Heart and lipids ----------------
  { marker_id: "LDL_C", unit: "mg/dL", applies_to: ANY, target_low: null, target_high: 100, direction: "lower_better",
    rationale: "LDL carries cholesterol into artery walls, and lower LDL over a lifetime means less plaque. Under 100 mg/dL is the level guidelines call optimal for most adults.",
    evidence_level: "Strong", source: "2018 AHA/ACC Cholesterol Guideline; NCEP ATP III", ...PENDING },
  { marker_id: "HDL_C", unit: "mg/dL", applies_to: { sex: "male" }, target_low: 40, target_high: null, direction: "higher_better",
    rationale: "Low HDL marks higher heart risk, though raising HDL with medication has not been shown to lower that risk. 40 mg/dL is the guideline cut-off for men.",
    evidence_level: "Moderate", source: "NCEP ATP III; AHA/NHLBI metabolic syndrome criteria", ...PENDING },
  { marker_id: "HDL_C", unit: "mg/dL", applies_to: { sex: "female" }, target_low: 50, target_high: null, direction: "higher_better",
    rationale: "Low HDL marks higher heart risk, though raising HDL with medication has not been shown to lower that risk. 50 mg/dL is the guideline cut-off for women.",
    evidence_level: "Moderate", source: "NCEP ATP III; AHA/NHLBI metabolic syndrome criteria", ...PENDING },
  { marker_id: "TOTAL_CHOLESTEROL", unit: "mg/dL", applies_to: ANY, target_low: null, target_high: 200, direction: "lower_better",
    rationale: "Total cholesterol adds the helpful and harmful fractions together, so LDL and ApoB say more. Under 200 mg/dL is the long-standing desirable level.",
    evidence_level: "Moderate", source: "NCEP ATP III", ...PENDING },
  { marker_id: "TRIGLYCERIDES", unit: "mg/dL", applies_to: ANY, target_low: null, target_high: 150, direction: "lower_better",
    rationale: "Fasting triglycerides above 150 mg/dL travel with insulin resistance and higher heart risk. Diet, alcohol and activity move them quickly.",
    evidence_level: "Moderate", source: "2018 AHA/ACC Cholesterol Guideline; NCEP ATP III", ...PENDING },
  { marker_id: "APOB", unit: "mg/dL", applies_to: ANY, target_low: null, target_high: 90, direction: "lower_better",
    rationale: "ApoB counts the particles that cause plaque, one per particle, so it can show risk that LDL misses. Under 90 mg/dL is a common primary-prevention goal; 130 or above is a recognised risk-enhancing level.",
    evidence_level: "Moderate", source: "National Lipid Association 2024 ApoB statement; 2018 AHA/ACC Cholesterol Guideline", ...PENDING },
  { marker_id: "LPA", unit: "nmol/L", applies_to: ANY, target_low: null, target_high: 125, direction: "lower_better",
    rationale: "Lp(a) is set mostly by your genes and changes little with lifestyle, so one measurement is usually enough. At 125 nmol/L or above it adds to heart risk, which makes the other lipids more important to keep low.",
    evidence_level: "Moderate", source: "2022 EAS Lp(a) consensus statement; NLA 2019 Lp(a) statement", ...PENDING },
  { marker_id: "LPA", unit: "mg/dL", applies_to: ANY, target_low: null, target_high: 50, direction: "lower_better",
    rationale: "Lp(a) is set mostly by your genes and changes little with lifestyle, so one measurement is usually enough. At 50 mg/dL or above it adds to heart risk, which makes the other lipids more important to keep low.",
    evidence_level: "Moderate", source: "2022 EAS Lp(a) consensus statement; NLA 2019 Lp(a) statement", ...PENDING },

  // ---------------- Metabolic ----------------
  { marker_id: "FASTING_GLUCOSE", unit: "mg/dL", applies_to: ANY, target_low: 70, target_high: 99, direction: "range",
    rationale: "Fasting glucose of 100 mg/dL or above is the prediabetes range, and below 70 is low. 70–99 is the normal fasting range.",
    evidence_level: "Strong", source: "ADA Standards of Care in Diabetes 2025", ...PENDING },
  { marker_id: "HBA1C", unit: "%", applies_to: ANY, target_low: null, target_high: 5.7, direction: "lower_better",
    rationale: "A1c reflects average blood sugar over about three months. 5.7% or above is the prediabetes range.",
    evidence_level: "Strong", source: "ADA Standards of Care in Diabetes 2025", ...PENDING },
  { marker_id: "FASTING_INSULIN", unit: "uIU/mL", applies_to: ANY, target_low: null, target_high: 10, direction: "lower_better",
    rationale: "Fasting insulin can rise years before glucose does. No guideline sets a target; under 10 uIU/mL is a cut-off used in research on insulin resistance.",
    evidence_level: "Emerging", source: "No guideline target; research cut-offs for insulin resistance (HOMA-IR studies)", ...PENDING },

  // ---------------- Inflammation ----------------
  { marker_id: "HS_CRP", unit: "mg/L", applies_to: ANY, target_low: null, target_high: 2.0, direction: "lower_better",
    rationale: "hs-CRP measures low-grade inflammation that is linked to heart risk. 2.0 mg/L or above is a recognised risk-enhancing level; a recent cold or injury can raise it for a few weeks.",
    evidence_level: "Moderate", source: "2018 AHA/ACC Cholesterol Guideline; AHA/CDC 2003 scientific statement", ...PENDING },
  { marker_id: "WBC", unit: "x10^9/L", applies_to: ANY, target_low: 4.0, target_high: 8.0, direction: "range",
    rationale: "White cells fight infection, so a recent illness moves this number. Large studies link counts toward the top of the lab range to higher heart risk; no guideline sets this narrower target.",
    evidence_level: "Emerging", source: "No guideline target; cohort studies of WBC and cardiovascular risk", ...PENDING },

  // ---------------- Organ function ----------------
  { marker_id: "ALBUMIN", unit: "g/dL", applies_to: ANY, target_low: 4.0, target_high: 5.0, direction: "range",
    rationale: "Albumin is made by the liver and reflects nutrition and liver health. Values in the low end of the lab range are linked to poorer outcomes in large studies.",
    evidence_level: "Moderate", source: "Adult reference intervals; cohort studies of serum albumin", ...PENDING },
  { marker_id: "CREATININE", unit: "mg/dL", applies_to: { sex: "male" }, target_low: 0.7, target_high: 1.2, direction: "range",
    rationale: "Creatinine is a muscle by-product the kidneys clear, so read it alongside eGFR. More muscle means a higher number without any kidney problem.",
    evidence_level: "Moderate", source: "Adult reference intervals; KDIGO 2024 CKD Guideline", ...PENDING },
  { marker_id: "CREATININE", unit: "mg/dL", applies_to: { sex: "female" }, target_low: 0.5, target_high: 1.0, direction: "range",
    rationale: "Creatinine is a muscle by-product the kidneys clear, so read it alongside eGFR. More muscle means a higher number without any kidney problem.",
    evidence_level: "Moderate", source: "Adult reference intervals; KDIGO 2024 CKD Guideline", ...PENDING },
  { marker_id: "EGFR", unit: "mL/min/1.73m2", applies_to: ANY, target_low: 60, target_high: null, direction: "higher_better",
    rationale: "eGFR estimates how well the kidneys filter. Below 60 for three months or more defines chronic kidney disease; it drifts down slowly with age, so the trend matters as much as the number.",
    evidence_level: "Strong", source: "KDIGO 2024 CKD Guideline", ...PENDING },
  { marker_id: "ALT", unit: "U/L", applies_to: { sex: "male" }, target_low: null, target_high: 33, direction: "lower_better",
    rationale: "ALT is a liver enzyme that rises when liver cells are stressed, most often by fat in the liver. The guideline's healthy upper limit for men is 33 U/L, lower than many lab ranges.",
    evidence_level: "Moderate", source: "ACG Clinical Guideline: Evaluation of Abnormal Liver Chemistries (2017)", ...PENDING },
  { marker_id: "ALT", unit: "U/L", applies_to: { sex: "female" }, target_low: null, target_high: 25, direction: "lower_better",
    rationale: "ALT is a liver enzyme that rises when liver cells are stressed, most often by fat in the liver. The guideline's healthy upper limit for women is 25 U/L, lower than many lab ranges.",
    evidence_level: "Moderate", source: "ACG Clinical Guideline: Evaluation of Abnormal Liver Chemistries (2017)", ...PENDING },
  { marker_id: "AST", unit: "U/L", applies_to: ANY, target_low: null, target_high: 35, direction: "lower_better",
    rationale: "AST is found in the liver and in muscle, so a hard workout can raise it for a few days. Read it together with ALT.",
    evidence_level: "Moderate", source: "Adult reference intervals; ACG Clinical Guideline (2017)", ...PENDING },
  { marker_id: "ALP", unit: "U/L", applies_to: ANY, target_low: 40, target_high: 120, direction: "range",
    rationale: "Alkaline phosphatase comes from the liver and bone. This target matches the usual adult range; values outside it are worth a look alongside the other liver markers.",
    evidence_level: "Moderate", source: "Adult reference intervals; ACG Clinical Guideline (2017)", ...PENDING },

  // ---------------- Blood ----------------
  { marker_id: "HEMOGLOBIN", unit: "g/dL", applies_to: { sex: "male" }, target_low: 13.0, target_high: 17.0, direction: "range",
    rationale: "Hemoglobin carries oxygen in the blood. Below 13 g/dL in men is the WHO definition of anemia.",
    evidence_level: "Strong", source: "WHO 2024 guideline on haemoglobin cut-offs for anaemia", ...PENDING },
  { marker_id: "HEMOGLOBIN", unit: "g/dL", applies_to: { sex: "female" }, target_low: 12.0, target_high: 15.5, direction: "range",
    rationale: "Hemoglobin carries oxygen in the blood. Below 12 g/dL in non-pregnant women is the WHO definition of anemia.",
    evidence_level: "Strong", source: "WHO 2024 guideline on haemoglobin cut-offs for anaemia", ...PENDING },
  { marker_id: "RDW", unit: "%", applies_to: ANY, target_low: null, target_high: 13.5, direction: "lower_better",
    rationale: "RDW measures how much your red cells vary in size; it widens early in iron or B12 shortage. Large studies link higher RDW, even inside the lab range, to higher overall risk; no guideline sets this target.",
    evidence_level: "Emerging", source: "No guideline target; cohort studies of RDW and mortality", ...PENDING },
  { marker_id: "MCV", unit: "fL", applies_to: ANY, target_low: 80, target_high: 100, direction: "range",
    rationale: "MCV is the average size of your red cells. Small cells point toward iron shortage and large cells toward B12 or folate shortage.",
    evidence_level: "Strong", source: "Standard haematology definitions of microcytosis and macrocytosis", ...PENDING },

  // ---------------- Nutrients ----------------
  { marker_id: "VITAMIN_D_25OH", unit: "ng/mL", applies_to: ANY, target_low: 20, target_high: 50, direction: "range",
    rationale: "The 2024 Endocrine Society guideline advises against routine vitamin D testing, and against aiming for a particular level, in healthy adults under 75. If you have been tested, 20–50 ng/mL is the range the National Academy of Medicine considers adequate and safe.",
    evidence_level: "Emerging", source: "Endocrine Society 2024 Clinical Practice Guideline; National Academy of Medicine (IOM) 2011", ...PENDING },
  { marker_id: "VITAMIN_D_25OH", unit: "ng/mL", applies_to: { sex: "any", age_min: 75 }, target_low: 20, target_high: 50, direction: "range",
    rationale: "For adults 75 and over, the 2024 Endocrine Society guideline suggests a daily vitamin D supplement but still advises against routine testing or aiming for a particular level. 20–50 ng/mL is the range the National Academy of Medicine considers adequate and safe.",
    evidence_level: "Emerging", source: "Endocrine Society 2024 Clinical Practice Guideline; National Academy of Medicine (IOM) 2011", ...PENDING },
  { marker_id: "FERRITIN", unit: "ng/mL", applies_to: { sex: "male" }, target_low: 30, target_high: 200, direction: "range",
    rationale: "Ferritin reflects your iron stores. Below 30 ng/mL usually means low iron, and above 200 in a healthy man can point to iron overload; inflammation raises it too.",
    evidence_level: "Moderate", source: "WHO 2020 guideline on ferritin to assess iron status", ...PENDING },
  { marker_id: "FERRITIN", unit: "ng/mL", applies_to: { sex: "female" }, target_low: 30, target_high: 150, direction: "range",
    rationale: "Ferritin reflects your iron stores. Below 30 ng/mL usually means low iron, and above 150 in a healthy woman can point to iron overload; inflammation raises it too.",
    evidence_level: "Moderate", source: "WHO 2020 guideline on ferritin to assess iron status", ...PENDING },
  { marker_id: "B12", unit: "pg/mL", applies_to: ANY, target_low: 300, target_high: 900, direction: "range",
    rationale: "B12 below 200 pg/mL is deficient, and 200–300 is a grey zone where a follow-up test (MMA) can confirm a shortage. Metformin and acid-reducing medicines can lower it.",
    evidence_level: "Moderate", source: "BSH 2014 guideline on cobalamin and folate disorders; NIH Office of Dietary Supplements", ...PENDING },

  // ---------------- Thyroid (shown per marker; not part of the scorecard) ----------------
  { marker_id: "TSH", unit: "mIU/L", applies_to: ANY, target_low: 0.45, target_high: 4.5, direction: "range",
    rationale: "TSH is the brain's signal to the thyroid: high suggests an underactive thyroid, low an overactive one. This target matches the usual adult reference range.",
    evidence_level: "Moderate", source: "ATA/AACE 2012 Hypothyroidism Guideline; NHANES III reference population", ...PENDING },
  { marker_id: "TSH", unit: "mIU/L", applies_to: { sex: "any", age_min: 70 }, target_low: 0.45, target_high: 6.0, direction: "range",
    rationale: "TSH naturally drifts up with age, so a slightly higher value is common and usually healthy after 70. This wider target reflects that.",
    evidence_level: "Moderate", source: "ATA/AACE 2012 Hypothyroidism Guideline (age-specific TSH limits)", ...PENDING },
  { marker_id: "FREE_T4", unit: "ng/dL", applies_to: ANY, target_low: 0.8, target_high: 1.8, direction: "range",
    rationale: "Free T4 is the main hormone the thyroid releases. Read it with TSH: the pair says more than either number alone.",
    evidence_level: "Moderate", source: "ATA/AACE 2012 Hypothyroidism Guideline; adult reference intervals", ...PENDING },
];

/* ---------------- lab names → marker ids ---------------- */

// The escalation matrix's aliases (agents/lib/escalation.mjs) for the markers it
// carries, extended with the names labs print for the rest. `excludes` are the
// neighbours that share a word and are a different test.
const NAMES = {
  LDL_C: { aliases: ["ldl", "ldl cholesterol", "ldl-c", "ldl chol calc", "ldl calculated", "ldl direct", "low density lipoprotein"], excludes: ["particle", "ldl-p", "size", "small", "ratio", "hdl", "vldl", "oxidized"] },
  HDL_C: { aliases: ["hdl", "hdl cholesterol", "hdl-c"], excludes: ["non hdl", "non-hdl", "nonhdl", "ratio", "particle", "hdl-p", "size"] },
  TOTAL_CHOLESTEROL: { aliases: ["cholesterol", "total cholesterol", "cholesterol, total", "cholesterol total"], excludes: ["hdl", "ldl", "vldl", "non", "ratio", "remnant"] },
  TRIGLYCERIDES: { aliases: ["triglycerides", "trigs", "tg", "triglyceride"], excludes: ["ratio"] },
  APOB: { aliases: ["apob", "apolipoprotein b", "apo b", "apolipoprotein b-100"], excludes: ["ratio", "apoa", "apo a"] },
  LPA: { aliases: ["lp(a)", "lpa", "lipoprotein a", "lipoprotein(a)", "lipoprotein (a)", "lp a", "lp (a)"], excludes: [] },
  FASTING_GLUCOSE: { aliases: ["fasting glucose", "glucose fasting", "glucose", "fasting blood glucose", "fbg", "fasting plasma glucose", "blood glucose"], excludes: ["urine", "tolerance", "csf", "random", "post", "2 hour", "2-hour", "1 hour", "average", "eag", "estimated"] },
  HBA1C: { aliases: ["hba1c", "hemoglobin a1c", "haemoglobin a1c", "a1c", "glycated hemoglobin", "hgb a1c"], excludes: [] },
  FASTING_INSULIN: { aliases: ["fasting insulin", "insulin", "insulin fasting"], excludes: ["growth factor", "igf", "antibod", "resistance", "homa"] },
  HS_CRP: { aliases: ["hs-crp", "hscrp", "hs crp", "high sensitivity crp", "c-reactive protein", "crp", "cardiac crp"], excludes: [] },
  WBC: { aliases: ["wbc", "white blood cell count", "white blood cells", "white blood cell", "leukocytes", "leukocyte count"], excludes: ["urine", "differential", "esterase"] },
  ALBUMIN: { aliases: ["albumin", "serum albumin", "albumin serum"], excludes: ["urine", "micro", "ratio", "globulin", "prealbumin", "creatinine"] },
  CREATININE: { aliases: ["creatinine", "serum creatinine", "creatinine serum"], excludes: ["urine", "ratio", "clearance", "egfr", "kinase", "24 hour", "24-hour"] },
  EGFR: { aliases: ["egfr", "gfr", "estimated gfr", "gfr estimated", "egfr non-african american", "egfr creat"], excludes: [] },
  ALT: { aliases: ["alt", "alt (sgpt)", "sgpt", "alanine aminotransferase", "alanine transaminase"], excludes: [] },
  AST: { aliases: ["ast", "ast (sgot)", "sgot", "aspartate aminotransferase", "aspartate transaminase"], excludes: [] },
  ALP: { aliases: ["alkaline phosphatase", "alp", "alk phos", "alkaline phosphatase, serum"], excludes: ["bone", "isoenzyme"] },
  HEMOGLOBIN: { aliases: ["hemoglobin", "haemoglobin", "hgb", "hb"], excludes: ["a1c", "glycated", "glycosylated", "urine", "corpuscular", "mch", "electrophoresis", "variant", "fetal"] },
  RDW: { aliases: ["rdw", "rdw-cv", "red cell distribution width", "red blood cell distribution width"], excludes: ["rdw-sd"] },
  MCV: { aliases: ["mcv", "mean corpuscular volume", "mean cell volume"], excludes: [] },
  VITAMIN_D_25OH: { aliases: ["vitamin d", "25-oh vitamin d", "vitamin d 25 hydroxy", "25 hydroxyvitamin d", "vit d", "vitamin d3", "vitamin d, 25-oh", "25-hydroxyvitamin d"], excludes: ["1,25", "1 25", "dihydroxy"] },
  FERRITIN: { aliases: ["ferritin", "serum ferritin"], excludes: [] },
  B12: { aliases: ["vitamin b12", "b12", "vitamin b-12", "cobalamin", "cyanocobalamin"], excludes: ["binding", "transcobalamin", "methylmalonic"] },
  TSH: { aliases: ["tsh", "thyroid stimulating hormone", "thyrotropin"], excludes: ["receptor", "antibod", "immunoglobulin"] },
  FREE_T4: { aliases: ["free t4", "t4, free", "t4 free", "free thyroxine", "ft4", "thyroxine, free", "thyroxine (t4) free"], excludes: ["index", "total"] },
  // No target row: blood pressure is part of the heart scorecard but is not a lab.
  // It only counts when a reading arrived as a row (a document or a future vitals feed).
  BLOOD_PRESSURE: { aliases: ["blood pressure", "systolic blood pressure", "systolic bp", "systolic"], excludes: ["diastolic"] },
};

// Same normalisation as escalation.mjs and clinicalRules.js: whole tokens, so
// "non-HDL cholesterol" never answers to "hdl", with the comma kept for
// "vitamin d, 25-oh" and "t4, free".
const normalizeName = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9()\s.,-]/g, " ").replace(/\s+/g, " ").trim();

function matchesAlias(normalized, alias) {
  const a = normalizeName(alias);
  if (normalized === a) return true;
  const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\s(,])${escaped}($|[\\s),])`).test(normalized);
}

/** The marker id a lab row's printed name refers to, or null. Longest alias wins. */
function markerIdFor(name) {
  const n = normalizeName(name);
  if (!n) return null;
  let best = null;
  for (const [id, { aliases, excludes }] of Object.entries(NAMES)) {
    if (excludes.some((x) => n.includes(normalizeName(x)))) continue;
    for (const a of aliases) {
      if (matchesAlias(n, a) && (!best || a.length > best.len)) best = { id, len: a.length };
    }
  }
  return best?.id || null;
}

/* ---------------- units ---------------- */

// Spellings of the SAME unit, never conversions (as escalation.mjs). A target is only
// shown against a value in the unit the target is written in; Lp(a) in nmol/L and
// mg/dL are different quantities, so each has its own row.
const SAME_UNIT = {
  "x10^9/l": ["10^9/l", "x10e9/l", "10e9/l", "10*9/l", "x109/l", "k/ul", "k/mm3", "x10^3/ul", "10^3/ul", "x10e3/ul", "10e3/ul", "10*3/ul", "x103/ul", "thou/ul", "th/mm3", "x10(3)/ul", "10(3)/ul"],
  "ml/min/1.73m2": ["ml/min/1.73m^2", "ml/min/1.73", "ml/min/1.73sqm", "ml/min/1.73msq", "ml/min"],
  "uiu/ml": ["uu/ml", "miu/l", "mu/l"],
  "u/l": ["iu/l"],
  "ng/ml": ["ug/l"],
  "pg/ml": ["ng/l"],
  "mg/l": ["ug/ml"],
  "fl": ["um3"],
};
const UNIT_OF = new Map(Object.entries(SAME_UNIT).flatMap(([canon, alts]) => [[canon, canon], ...alts.map((a) => [a, canon])]));

function canonUnit(unit) {
  let u = String(unit ?? "").trim().toLowerCase()
    .replace(/[µμ]/g, "u").replace(/²/g, "2").replace(/³/g, "3").replace(/mcmol/g, "umol").replace(/mcg/g, "ug")
    .replace(/[\s{}_]/g, "");
  if (!u) return "";
  if (u.startsWith("%")) u = "%"; // "% of total Hgb"
  return UNIT_OF.get(u) || u;
}

const sameUnit = (a, b) => Boolean(canonUnit(a)) && canonUnit(a) === canonUnit(b);

/* ---------------- choosing the row that applies ---------------- */

function canonSex(sex) {
  const s = String(sex ?? "").trim().toLowerCase();
  if (/^(m|male|man)$/.test(s)) return "male";
  if (/^(f|female|woman|w)$/.test(s)) return "female";
  return null;
}

/** Whole years from a date of birth, or null. */
function ageFromDob(dob, now = new Date()) {
  if (!dob) return null;
  const d = new Date(String(dob).length <= 10 ? `${dob}T00:00:00` : dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/**
 * Keep only each marker's newest version. Revising a target is a new row with a
 * higher version, never an edit, so what a member was shown last month stays on file.
 */
function latestVersions(rows) {
  const top = new Map();
  for (const r of rows || []) top.set(r.marker_id, Math.max(top.get(r.marker_id) ?? -Infinity, Number(r.version) || 0));
  return (rows || []).filter((r) => (Number(r.version) || 0) === top.get(r.marker_id));
}

/** How many constraints a row's applies_to carries — the most specific match wins. */
function specificity(a = {}) {
  return (a.sex && a.sex !== "any" ? 1 : 0) + (a.age_min != null ? 1 : 0) + (a.age_max != null ? 1 : 0) + (a.condition ? 1 : 0);
}

/**
 * Does this row apply to this member? A sex- or age-specific row needs the member's
 * sex or age to be known: when it isn't, the row is skipped rather than guessed at,
 * and the screen shows the lab range alone. Rows tied to a condition are skipped
 * until intake conditions are wired through.
 */
function applies(a = {}, { sex, age }) {
  if (a.sex && a.sex !== "any" && a.sex !== sex) return false;
  if (a.age_min != null && (age == null || age < a.age_min)) return false;
  if (a.age_max != null && (age == null || age > a.age_max)) return false;
  if (a.condition) return false;
  return true;
}

/**
 * The target row for one reading, or null when no approved-or-placeholder target
 * fits: unknown marker, a unit the target is not written in, or a sex/age the
 * member's profile doesn't give.
 */
function targetFor(rows, { markerId, unit, sex, age }) {
  if (!markerId) return null;
  const who = { sex: canonSex(sex), age: Number.isFinite(age) ? age : null };
  let best = null;
  for (const r of rows || []) {
    if (r.marker_id !== markerId) continue;
    if (!sameUnit(r.unit, unit)) continue;
    if (!applies(r.applies_to || {}, who)) continue;
    if (!best || specificity(r.applies_to) > specificity(best.applies_to)) best = r;
  }
  return best;
}

/** "Under 100 mg/dL", "40 mg/dL or above", "70–99 mg/dL". */
function formatTarget(row) {
  if (!row) return "";
  const unit = row.unit ? ` ${row.unit}` : "";
  const lo = row.target_low, hi = row.target_high;
  if (row.direction === "lower_better" && hi != null) return `Under ${hi}${unit}`;
  if (row.direction === "higher_better" && lo != null) return `${lo}${unit} or above`;
  if (lo != null && hi != null) return `${lo}–${hi}${unit}`;
  if (hi != null) return `Under ${hi}${unit}`;
  if (lo != null) return `${lo}${unit} or above`;
  return "";
}

/**
 * Read the table. Null — never an empty list — when it can't be read (migration not
 * applied yet, offline, signed out), so the caller falls back to the bundled seed
 * instead of showing no targets at all. The client is passed in so this file keeps
 * no imports.
 */
async function fetchMarkerTargets(client) {
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("marker_targets")
      .select("marker_id, unit, applies_to, target_low, target_high, direction, rationale, evidence_level, source, approved_by, approved_date, version");
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return latestVersions(data.map((r) => ({
      ...r,
      target_low: r.target_low == null ? null : Number(r.target_low),
      target_high: r.target_high == null ? null : Number(r.target_high),
    })));
  } catch {
    return null;
  }
}

export {
  MARKER_TARGETS,
  markerIdFor,
  canonUnit,
  sameUnit,
  ageFromDob,
  latestVersions,
  targetFor,
  formatTarget,
  fetchMarkerTargets,
};
