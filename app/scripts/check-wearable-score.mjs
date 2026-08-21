/**
 * Regression check for the wearable scoring engine.
 *
 * The spec ships a worked example — Aug 19, scored against a 20-day history in the
 * ranges the member's own data covered — and states the answer: 30.5 / 50, "Fair",
 * with a 18.1 daily and 12.4 trend split. Any weight or threshold change that moves
 * that number is a clinical change and has to be a deliberate one, so this asserts it.
 *
 *   node scripts/check-wearable-score.mjs      (or: npm run score:check)
 */

import { calculateWearableScore, WEIGHTS, DAILY_MAX, TREND_MAX } from "../supabase/functions/_shared/wearableScore.js";

const fail = [];
const check = (name, actual, expected, tolerance = 0) => {
  const ok = typeof expected === "number" ? Math.abs(actual - expected) <= tolerance : actual === expected;
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${name}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
  if (!ok) fail.push(name);
};

/* ---- weights still sum to the rubric ------------------------------------- */
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
check("daily weights sum", sum(WEIGHTS.daily), DAILY_MAX);
check("trend weights sum", sum(WEIGHTS.trend), TREND_MAX);

/* ---- the spec's worked example ------------------------------------------- */
// A 20-day history built to the baselines the spec names — HRV ~95ms, RHR ~53bpm,
// sleep ~455min, efficiency 88%, SpO2 97% — with the most recent week running
// slightly stronger, which is what produces the spec's "good trajectory" trend.
// `day(1)` is the most recent prior day, so indexes under 6 are the trend window.
const day = (i) => `2026-08-${String(19 - i).padStart(2, "0")}`;
const recent = (i) => i < 6;
const history = Array.from({ length: 20 }, (_, i) => ({
  day: day(i + 1),
  hrv_ms: recent(i) ? 99 : 93,
  resting_hr: 53,
  total_sleep_minutes: recent(i) ? 460 : 452,
  sleep_efficiency: 0.88,
  spo2_percent: 97,
  steps: recent(i) ? 10200 : 8800,
  readiness_score: 80,
}));

const today = {
  day: "2026-08-19",
  hrv_ms: 77,
  resting_hr: 56,
  sleep_efficiency: 0.92,
  total_sleep_minutes: 486,
  spo2_percent: 96.3,
  steps: 10200,
  readiness_score: 83,
};

const result = calculateWearableScore(today, history);
const tier = (k) => result.daily.find((m) => m.key === k)?.tier;

console.log("\nAug 19 worked example:");
check("HRV tier", tier("hrv"), "poor");
check("RHR tier", tier("restingHR"), "fair");
check("sleep efficiency tier", tier("sleepEfficiency"), "good");
check("sleep duration tier", tier("sleepDuration"), "excellent");
check("SpO2 tier", tier("spo2"), "fair");
check("daily subtotal", result.dailyScore, 18.1, 0.1);
check("trend subtotal", result.trendScore, 12.4, 0.1);
check("total", result.totalScore, 30.5, 0.1);
check("label", result.label, "Fair");
check("confidence", result.confidence.percent, 100);
check("no false alerts", result.alerts.length, 0);
check("sanity check not flagged", result.sanityCheck.flagged, false);

/* ---- absolute safety floors override a flattering baseline --------------- */
console.log("\nSafety floors:");
const lowSpo2 = calculateWearableScore(
  { ...today, spo2_percent: 93 },
  history.map((r) => ({ ...r, spo2_percent: 93 })), // baseline drifted down too
);
check("SpO2 93% scores critical despite matching baseline", lowSpo2.daily.find((m) => m.key === "spo2").tier, "critical");
check("SpO2 93% raises an alert", lowSpo2.alerts.some((a) => a.metric === "spo2"), true);

const shortSleep = calculateWearableScore({ ...today, total_sleep_minutes: 290 }, history);
check("under 5h sleep scores critical", shortSleep.daily.find((m) => m.key === "sleepDuration").tier, "critical");

/* ---- cold start ---------------------------------------------------------- */
console.log("\nCold start:");
const brandNew = calculateWearableScore(today, history.slice(0, 3));
check("under 5 days → every daily metric Fair", brandNew.daily.every((m) => m.tier === "fair"), true);
check("under 5 days → 35% confidence", brandNew.confidence.percent, 35);

/* ---- baselines never look forward -------------------------------------- */
// The sync worker re-scores a trailing window of days in one pass, handing the whole
// window to every day it scores. An older day must still be judged only against the
// days before it, or a late Oura revision would rewrite last Tuesday's score using
// data from Thursday.
console.log("\nBaseline direction:");
const midDay = { ...today, day: history[3].day, hrv_ms: 77 };
const withFuture = calculateWearableScore(midDay, [today, ...history]);
const withoutFuture = calculateWearableScore(midDay, history.filter((r) => r.day < midDay.day));
check(
  "older day scores identically with and without later days present",
  withFuture.totalScore,
  withoutFuture.totalScore,
);
check("older day's baseline excludes later days", withFuture.baselines.hrv, withoutFuture.baselines.hrv);

console.log("");
if (fail.length) {
  console.error(`${fail.length} check(s) failed: ${fail.join(", ")}`);
  process.exit(1);
}
console.log("All wearable score checks passed.");
