/**
 * Regression check for the bloodwork scoring rubric.
 *
 * The rubric has no external worked example to reproduce — it was written here — so
 * these checks pin the decisions that would be easiest to break silently: the
 * threshold each band sits on, the markers that must never be confused with each
 * other, the results that must NOT be scored, and the refusal to score a panel that
 * is too thin or too old.
 *
 *   node scripts/check-bloodwork-score.mjs      (or: npm run bloodwork:check)
 */

import { calculateBloodworkScore, MARKERS, PANELS, BLOODWORK_MAX } from "../supabase/functions/_shared/bloodworkScore.js";

const fail = [];
const check = (name, actual, expected) => {
  const ok = actual === expected;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
  if (!ok) fail.push(name);
};

const NOW = new Date("2026-08-21T00:00:00Z");
const recent = "2026-07-01T00:00:00Z";
const lab = (name, value, unit, date = recent) => ({ name, value: String(value), unit, created_at: date });
const score = (labs, opts = {}) => calculateBloodworkScore(labs, { now: NOW, ...opts });
const tierOf = (result, key) => result.markers.find((m) => m.key === key)?.tier ?? "absent";

/* ---- the rubric adds up -------------------------------------------------- */
const declared = PANELS.reduce((sum, p) => sum + p.max, 0);
check("panel weights sum to 50", declared, BLOODWORK_MAX);
// Stand-in markers share their primary's weight, so they don't count toward the total.
const standIns = new Set(MARKERS.filter((m) => m.supersededBy).map((m) => m.key));
const markerSum = MARKERS.filter((m) => !standIns.has(m.key)).reduce((sum, m) => sum + m.points, 0);
check("marker weights sum to 50", markerSum, BLOODWORK_MAX);

/* ---- a strong full panel ------------------------------------------------- */
console.log("\nStrong panel:");
const strong = score([
  lab("Apolipoprotein B", 62, "mg/dL"), lab("Lp(a)", 8, "mg/dL"),
  lab("Triglycerides", 72, "mg/dL"), lab("HDL Cholesterol", 68, "mg/dL"),
  lab("Hemoglobin A1c", 5.1, "%"), lab("Glucose, Fasting", 84, "mg/dL"),
  lab("Fasting Insulin", 3.9, "uIU/mL"), lab("hs-CRP", 0.3, "mg/L"),
  lab("eGFR", 98, "mL/min/1.73"), lab("ALT (SGPT)", 17, "U/L"),
  lab("Vitamin D, 25-Hydroxy", 48, "ng/mL"), lab("Ferritin", 95, "ng/mL"), lab("TSH", 1.6, "mIU/L"),
], { sex: "male" });
check("scores as available", strong.available, true);
check("all markers excellent → 50", strong.totalScore, 50);
check("label", strong.label, "Excellent");
check("full coverage", strong.coverage.percent, 100);
check("no alerts", strong.alerts.length, 0);

/* ---- thresholds sit where the guidelines put them ------------------------ */
console.log("\nGuideline thresholds:");
check("ApoB 89 → good (under 90)", tierOf(score([lab("ApoB", 89, "mg/dL")].concat(strong.markers.length ? [] : [])), "apoB"), "good");
check("ApoB 91 → fair", tierOf(score([lab("ApoB", 91, "mg/dL")]), "apoB"), "fair");
check("HbA1c 5.6 → good (ADA normal)", tierOf(score([lab("HbA1c", 5.6, "%")]), "hba1c"), "good");
check("HbA1c 5.8 → fair (prediabetes)", tierOf(score([lab("HbA1c", 5.8, "%")]), "hba1c"), "fair");
check("HbA1c 6.6 → critical (diabetes range)", tierOf(score([lab("HbA1c", 6.6, "%")]), "hba1c"), "critical");
check("hs-CRP 0.8 → good (AHA low risk)", tierOf(score([lab("hs-CRP", 0.8, "mg/L")]), "hsCrp"), "good");
check("hs-CRP 4 → poor (AHA high risk)", tierOf(score([lab("hs-CRP", 4, "mg/L")]), "hsCrp"), "poor");
check("Lp(a) 55 mg/dL → poor (NLA high risk)", tierOf(score([lab("Lp(a)", 55, "mg/dL")]), "lpa"), "poor");
check("eGFR 52 → poor (KDIGO G3a)", tierOf(score([lab("eGFR", 52, "mL/min")]), "egfr"), "poor");

/* ---- sex-specific bands -------------------------------------------------- */
console.log("\nSex-specific bands:");
check("ALT 30 → good for a man (AASLD 33)", tierOf(score([lab("ALT", 30, "U/L")], { sex: "male" }), "alt"), "good");
check("ALT 30 → fair for a woman (AASLD 25)", tierOf(score([lab("ALT", 30, "U/L")], { sex: "female" }), "alt"), "fair");
check("HDL 48 → good for a man", tierOf(score([lab("HDL", 48, "mg/dL")], { sex: "male" }), "hdl"), "good");
check("HDL 48 → poor for a woman (below the 50 cutoff)", tierOf(score([lab("HDL", 48, "mg/dL")], { sex: "female" }), "hdl"), "poor");

/* ---- two-sided markers --------------------------------------------------- */
console.log("\nToo much is not better than enough:");
check("vitamin D 110 ng/mL → poor, not excellent", tierOf(score([lab("Vitamin D", 110, "ng/mL")]), "vitaminD"), "poor");
check("ferritin 1200 → critical", tierOf(score([lab("Ferritin", 1200, "ng/mL")], { sex: "male" }), "ferritin"), "critical");
check("glucose 55 → critical (hypoglycaemia)", tierOf(score([lab("Glucose, Fasting", 55, "mg/dL")]), "glucose"), "critical");
check("TSH 0.05 → critical", tierOf(score([lab("TSH", 0.05, "mIU/L")]), "tsh"), "critical");

/* ---- hs-CRP during an illness is not a risk result ----------------------- */
console.log("\nAcute-phase hs-CRP:");
const sick = score([lab("hs-CRP", 42, "mg/L"), lab("ApoB", 70, "mg/dL"), lab("HbA1c", 5.2, "%"), lab("Triglycerides", 80, "mg/dL")]);
check("hs-CRP over 10 is excluded, not scored 0", sick.markers.find((m) => m.key === "hsCrp").excluded, true);
check("excluded marker contributes no max", sick.coverage.points, 8 + 6 + 2);
check("and raises an informational flag", sick.alerts.some((a) => a.marker === "hsCrp" && a.severity === "info"), true);

/* ---- name collisions ----------------------------------------------------- */
console.log("\nMarker identification:");
const nonHdl = score([lab("Non-HDL Cholesterol", 105, "mg/dL")]);
check("'Non-HDL Cholesterol' is not read as HDL", tierOf(nonHdl, "hdl"), "absent");
check("...and scores as non-HDL", tierOf(nonHdl, "nonHdl"), "good");
const both = score([lab("ApoB", 65, "mg/dL"), lab("LDL Cholesterol", 150, "mg/dL"), lab("Non-HDL", 175, "mg/dL")]);
check("ApoB supersedes its stand-ins", tierOf(both, "apoB"), "excellent");
check("...and LDL is not double-counted", tierOf(both, "ldl"), "absent");

/* ---- units --------------------------------------------------------------- */
console.log("\nUnit conversion:");
// 100 nmol/L is ~47 mg/dL — intermediate risk. Read as mg/dL it would score "poor",
// which is exactly the misread the conversion exists to prevent.
check("Lp(a) 100 nmol/L → fair (~47 mg/dL), not poor", tierOf(score([lab("Lp(a)", 100, "nmol/L")]), "lpa"), "fair");
check("Lp(a) 100 mg/dL → critical (the same number, different unit)", tierOf(score([lab("Lp(a)", 100, "mg/dL")]), "lpa"), "critical");
check("HbA1c 36 mmol/mol → good (5.4%)", tierOf(score([lab("HbA1c", 36, "mmol/mol")]), "hba1c"), "good");
check("HbA1c 48 mmol/mol → critical (6.5%)", tierOf(score([lab("HbA1c", 48, "mmol/mol")]), "hba1c"), "critical");
check("glucose 4.8 mmol/L → excellent (86 mg/dL)", tierOf(score([lab("Glucose, Fasting", 4.8, "mmol/L")]), "glucose"), "excellent");
check("'< 5' parses as 5", score([lab("Fasting Insulin", "< 5", "uIU/mL")]).markers.find((m) => m.key === "insulin").value, 5);

/* ---- withheld rather than guessed ---------------------------------------- */
console.log("\nWhen not to show a score:");
const thin = score([lab("Vitamin D", 28, "ng/mL"), lab("TSH", 2.1, "mIU/L")]);
check("a two-marker panel is not scored", thin.available, false);
check("...and says why", Boolean(thin.unavailableReason), true);
const stale = score([
  lab("ApoB", 62, "mg/dL", "2023-01-01T00:00:00Z"), lab("HbA1c", 5.1, "%", "2023-01-01T00:00:00Z"),
  lab("hs-CRP", 0.4, "mg/L", "2023-01-01T00:00:00Z"),
]);
check("a three-year-old panel is not scored", stale.available, false);
console.log("\nConfidence reflects partial coverage:");
const partial = score([lab("ApoB", 75, "mg/dL"), lab("HbA1c", 5.4, "%"), lab("hs-CRP", 0.9, "mg/L")]);
check("partial panel still scores", partial.available, true);
check("...but confidence is capped by coverage", partial.confidence.percent, partial.coverage.percent);

console.log("");
if (fail.length) {
  console.error(`${fail.length} check(s) failed: ${fail.join(", ")}`);
  process.exit(1);
}
console.log("All bloodwork score checks passed.");
