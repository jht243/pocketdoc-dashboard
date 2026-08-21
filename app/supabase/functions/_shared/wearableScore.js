/**
 * The wearable health score — the 50-point sub-score of the overall Health Score.
 *
 * Written to the rubric in `wearable-score-spec.docx` (v1.0, Aug 2026). Two rules
 * from that document drive everything else here:
 *
 *   1. The score is calculated from RAW biometric values only. Oura's own composite
 *      scores (readiness / sleep / activity) are stored and used as a sanity check,
 *      never as inputs — they are population-tuned black boxes, and the whole point
 *      of this score is that it is personal.
 *   2. Every metric is judged against the member's OWN rolling 20-day baseline, so
 *      the same 77ms HRV reading is "poor" for one member and "excellent" for
 *      another. Accuracy therefore improves as history accumulates, and how much
 *      history exists is disclosed rather than hidden.
 *
 * Pure: no network, no Deno, no DOM, no imports. It lives under `functions/_shared`
 * because the sync worker is the authoritative caller (the score is computed and
 * persisted server-side on every sync); `src/lib/wearableScore.js` re-exports it so
 * the browser scores identically off the same file rather than a drifting copy.
 *
 * Rows in and out are the flat `wearable_daily` shape — snake_case, vendor-neutral.
 *
 * Plain .js rather than .ts on purpose: Deno type-checks .ts strictly at deploy, and
 * the same file is imported by the browser build, so keeping it untyped keeps one
 * copy working in both toolchains rather than two copies working in one each.
 */

/** Bumped whenever a weight, threshold, or tier changes. Persisted with each score. */
export const SCORE_VERSION = "1.0";

/** Rolling window every baseline is computed over. */
export const BASELINE_DAYS = 20;
/** The short window the trend component compares against that baseline. */
export const TREND_DAYS = 7;
/** Below this many days there is no honest baseline — see CONFIDENCE_TIERS. */
export const MIN_BASELINE_DAYS = 5;

/**
 * THE single adjustment point for the whole rubric.
 *
 * Daily weights must sum to 35 and trend weights to 15. Any change here is a
 * clinical decision, not a code decision: the spec calls for quarterly review by the
 * medical director, and `npm run score:check` must be re-run afterwards — it asserts
 * the worked example from the spec still scores 30.5.
 *
 * Rationale for the split, from the rubric:
 *   hrv            40%  strongest single indicator of autonomic state and recovery
 *   restingHR      23%  cardiovascular load; rises before a member feels ill
 *   sleepEfficiency 14%  quality, which matters more than raw hours
 *   sleepDuration  11%  quantity, with an absolute floor under it
 *   spo2           11%  the only metric with hard clinical floors of its own
 */
export const WEIGHTS = {
  daily: { hrv: 14, restingHR: 8, sleepEfficiency: 5, sleepDuration: 4, spo2: 4 },
  trend: { hrv: 6, restingHR: 4, sleepDuration: 3, steps: 2 },
};

export const DAILY_MAX = 35;
export const TREND_MAX = 15;
export const WEARABLE_MAX = DAILY_MAX + TREND_MAX;

/** Tier multipliers. `critical` scoring 0 also raises an alert. */
export const TIER_MULTIPLIERS = {
  excellent: 1,
  good: 0.8,
  fair: 0.55,
  poor: 0.25,
  critical: 0,
};

/**
 * Deviation bands, expressed against the member's baseline as a percentage.
 *
 * Written once, for a metric where MORE is better. Metrics where less is better
 * (resting heart rate) negate their deviation before the lookup, so a 6% rise in RHR
 * and a 6% fall in HRV land in the same tier. The spec's RHR column states the bands
 * separately and leaves a gap between -5% and -3%; mirroring one table removes the
 * gap without changing any threshold the spec actually names.
 */
const TIER_BANDS = [
  { tier: "excellent", min: 5 },
  { tier: "good", min: -3 },
  { tier: "fair", min: -10 },
  { tier: "poor", min: -20 },
  { tier: "critical", min: -Infinity },
];

/** Metrics where a lower reading is the better reading. */
const LOWER_IS_BETTER = new Set(["restingHR"]);

/** Field mapping: score key → `wearable_daily` column. */
const FIELDS = {
  hrv: "hrv_ms",
  restingHR: "resting_hr",
  sleepEfficiency: "sleep_efficiency",
  sleepDuration: "total_sleep_minutes",
  spo2: "spo2_percent",
  steps: "steps",
};

export const METRIC_LABELS = {
  hrv: "Heart rate variability",
  restingHR: "Resting heart rate",
  sleepEfficiency: "Sleep efficiency",
  sleepDuration: "Sleep duration",
  spo2: "Blood oxygen (SpO₂)",
  steps: "Steps",
};

const UNITS = {
  hrv: "ms",
  restingHR: "bpm",
  sleepEfficiency: "%",
  sleepDuration: "min",
  spo2: "%",
  steps: "",
};

/**
 * Absolute safety floors — clinical thresholds that override the baseline tier
 * whenever the raw value is worse than the tier would suggest.
 *
 * A member whose baseline SpO₂ has drifted down to 94% would otherwise score
 * "excellent" at 94%, which is exactly the failure mode a personalized score has to
 * be protected against. Ordered worst-first; the first match wins.
 */
const SAFETY_FLOORS = {
  spo2: [
    { below: 95, tier: "critical", alert: "Blood oxygen below 95% overnight. Worth raising with a clinician if it persists." },
    { below: 96, tier: "poor", alert: "Blood oxygen is trending low. Keep an eye on it over the next few nights." },
    { below: 97, tier: "fair", alert: null },
  ],
  sleepDuration: [
    { below: 300, tier: "critical", alert: "Under 5 hours of sleep. Recovery, focus and cardiovascular load are all affected at this level." },
    { below: 360, tier: "poor", alert: "Under 6 hours of sleep — short of what recovery needs." },
  ],
  sleepEfficiency: [
    { below: 75, tier: "critical", alert: "Sleep efficiency is very low — a large share of time in bed was spent awake." },
    { below: 82, tier: "poor", alert: "Sleep efficiency is below its usual range." },
  ],
};

/**
 * How much history exists → how much the score can be trusted, disclosed to the
 * member. Under 5 days there is no baseline at all and every metric defaults to
 * Fair, which the spec calls "indicative only".
 */
const CONFIDENCE_TIERS = [
  { minDays: 20, percent: 100, note: "Full 20-day baseline in use." },
  { minDays: 14, percent: 85, note: "Based on 14+ days of history — accuracy improves as it builds." },
  { minDays: 7, percent: 70, note: "Based on a week or more of history — accuracy improves as it builds." },
  { minDays: 5, percent: 55, note: "Based on only a few days of history — treat this as an early read." },
  { minDays: 0, percent: 35, note: "Not enough history for a personal baseline yet — indicative only." },
];

/** Score bands for the member-facing label, on the combined 0–50 scale. */
const SCORE_LABELS = [
  { min: 45, label: "Excellent", token: "excellent" },
  { min: 38, label: "Good", token: "good" },
  { min: 28, label: "Fair", token: "fair" },
  { min: 18, label: "Low", token: "low" },
  { min: 0, label: "Critical", token: "critical" },
];

/* ------------------------------------------------------------------ helpers */

const isNum = (v) => v != null && v !== "" && Number.isFinite(Number(v));
const round = (n, dp = 1) => (isNum(n) ? Number(Number(n).toFixed(dp)) : null);

/**
 * Sleep efficiency reaches us as a 0–1 fraction from the Oura mapping, but the
 * clinical floors are written in percent and other sources report percent directly.
 * Normalizing on the way in means one representation inside the engine.
 */
function normalize(key, raw) {
  if (!isNum(raw)) return null;
  const value = Number(raw);
  if (key === "sleepEfficiency" && value <= 1.5) return value * 100;
  return value;
}

/** One metric's value out of a raw row, normalized. Null when not recorded. */
function readMetric(row, key) {
  return row ? normalize(key, row[FIELDS[key]]) : null;
}

const mean = (values) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

/**
 * Newest-first, one row per day, today excluded from nothing — callers pass the
 * whole window and the engine decides what belongs in which calculation. Accepting
 * any order matters because the sync worker reads ascending and the app descending.
 */
function orderedWindow(today, history) {
  const byDay = new Map();
  for (const row of history || []) {
    if (row?.day) byDay.set(row.day, row);
  }
  if (today?.day) byDay.set(today.day, today);
  return [...byDay.values()].sort((a, b) => String(b.day).localeCompare(String(a.day)));
}

/* ---------------------------------------------------------------- baselines */

/**
 * The member's own 20-day rolling average for every scored metric, plus how many
 * days actually carried a reading.
 *
 * Baselines look strictly BACKWARDS from the day being scored. Two reasons, and both
 * bite in practice: an average that already contains today pulls the reference toward
 * the very value under test and flattens real deviations, and the sync worker re-scores
 * a trailing window of days at once — so without the cutoff, Tuesday would be judged
 * against a baseline containing Wednesday and Thursday. A metric with fewer than
 * MIN_BASELINE_DAYS readings gets no baseline at all rather than a confident-looking
 * average of two nights.
 */
export function computeBaselines(today, history) {
  const window = orderedWindow(today, history);
  const scoredDay = today?.day ?? null;
  const priorDays = window
    .filter((row) => (scoredDay ? String(row.day) < String(scoredDay) : row.day !== today?.day))
    .slice(0, BASELINE_DAYS);

  const baselines = {};
  const samples = {};
  for (const key of Object.keys(FIELDS)) {
    const values = priorDays.map((row) => readMetric(row, key)).filter(isNum);
    samples[key] = values.length;
    baselines[key] = values.length >= MIN_BASELINE_DAYS ? mean(values) : null;
  }

  // The trend window is everything up to AND INCLUDING the scored day; anything
  // after it belongs to a day that hasn't been scored yet.
  const trendWindow = window.filter((row) => (scoredDay ? String(row.day) <= String(scoredDay) : true));

  return { baselines, samples, historyDays: priorDays.length, window: trendWindow };
}

export function confidenceFor(historyDays) {
  const tier = CONFIDENCE_TIERS.find((t) => historyDays >= t.minDays) || CONFIDENCE_TIERS[CONFIDENCE_TIERS.length - 1];
  return { percent: tier.percent, note: tier.note, historyDays };
}

export function getScoreLabel(totalScore) {
  const band = SCORE_LABELS.find((b) => totalScore >= b.min) || SCORE_LABELS[SCORE_LABELS.length - 1];
  return { label: band.label, token: band.token };
}

export function getMetricLabel(key) {
  return METRIC_LABELS[key] || key;
}

/* -------------------------------------------------------------------- tiers */

/** Percentage deviation from baseline, signed in the metric's own direction. */
function deviationPct(key, value, baseline) {
  if (!isNum(value) || !isNum(baseline) || baseline === 0) return null;
  const pct = ((value - baseline) / baseline) * 100;
  return LOWER_IS_BETTER.has(key) ? -pct : pct;
}

function tierForDeviation(pct) {
  return (TIER_BANDS.find((band) => pct >= band.min) || TIER_BANDS[TIER_BANDS.length - 1]).tier;
}

const TIER_ORDER = ["critical", "poor", "fair", "good", "excellent"];
const worseOf = (a, b) => (TIER_ORDER.indexOf(a) <= TIER_ORDER.indexOf(b) ? a : b);

/**
 * Score one metric: baseline tier first, then any absolute floor that is worse.
 *
 * Missing data scores Fair and raises nothing — a night without the ring is not
 * evidence of poor health. It is also not evidence of good health, which is why the
 * confidence figure exists and why `recorded: false` is carried through to the UI.
 */
function scoreMetric(key, value, baseline, maxPoints, hasBaseline) {
  const label = getMetricLabel(key);
  const base = {
    key,
    label,
    unit: UNITS[key],
    value: round(value, key === "sleepEfficiency" || key === "spo2" ? 1 : 0),
    baseline: round(baseline, 1),
    max: maxPoints,
  };

  if (!isNum(value)) {
    return {
      ...base,
      recorded: false,
      deviationPct: null,
      tier: "fair",
      multiplier: TIER_MULTIPLIERS.fair,
      points: round(maxPoints * TIER_MULTIPLIERS.fair, 1),
      floorApplied: null,
      alert: null,
      note: "Not recorded — scored neutrally.",
    };
  }

  const pct = hasBaseline ? deviationPct(key, value, baseline) : null;
  // No usable baseline yet (new member, or a metric this ring rarely records):
  // Fair is the spec's neutral default, neither rewarding nor punishing.
  let tier = pct == null ? "fair" : tierForDeviation(pct);

  let floorApplied = null;
  let alert = null;
  for (const floor of SAFETY_FLOORS[key] || []) {
    if (value < floor.below) {
      const floored = worseOf(tier, floor.tier);
      if (floored !== tier || floor.alert) {
        floorApplied = { below: floor.below, tier: floor.tier };
        if (floor.alert) alert = { metric: key, label, severity: floor.tier, value: round(value, 1), threshold: floor.below, message: floor.alert };
      }
      tier = floored;
      break; // floors are ordered worst-first; the first match is the binding one
    }
  }

  if (tier === "critical" && !alert) {
    alert = {
      metric: key,
      label,
      severity: "critical",
      value: round(value, 1),
      threshold: round(baseline, 1),
      message: `${label} is more than 20% away from your usual range.`,
    };
  }

  return {
    ...base,
    recorded: true,
    deviationPct: round(pct, 1),
    tier,
    multiplier: TIER_MULTIPLIERS[tier],
    points: round(maxPoints * TIER_MULTIPLIERS[tier], 1),
    floorApplied,
    alert,
    note: pct == null ? "No personal baseline yet — scored neutrally." : null,
  };
}

/* -------------------------------------------------------------------- trend */

/**
 * The 15-point trend component: each metric's 7-day average against its 20-day
 * baseline, through the same tier table.
 *
 * This is what catches the member whose individual days all look acceptable while
 * the trajectory quietly deteriorates — and equally, gives credit to someone having
 * one rough day inside a good fortnight. Gaps are skipped rather than zero-filled:
 * a week with four recorded nights averages those four.
 */
function scoreTrend(window, baselines, samples) {
  // Includes the day being scored — a 7-day average that excluded today would lag a
  // real change by a full day, which is the opposite of what a trend is for.
  const recent = window.slice(0, TREND_DAYS);

  return Object.entries(WEIGHTS.trend).map(([key, maxPoints]) => {
    const values = recent.map((row) => readMetric(row, key)).filter(isNum);
    const recentAvg = mean(values);
    const baseline = baselines[key];
    const hasBaseline = isNum(baseline) && samples[key] >= MIN_BASELINE_DAYS;

    const scored = scoreMetric(key, recentAvg, baseline, maxPoints, hasBaseline);
    return {
      ...scored,
      label: `${scored.label} — ${TREND_DAYS}-day trend`,
      // A trend is a direction, not a reading: a single bad night inside the window
      // shouldn't produce a clinical alert twice over. The daily component owns alerts.
      alert: null,
      samples: values.length,
    };
  });
}

/* ------------------------------------------------------------ sanity check */

/**
 * Oura's readiness score, normalized to our 50-point scale, compared to what we
 * calculated. A wide gap usually means a bug in here, not a disagreement worth
 * telling the member about — so this is a developer flag only, exactly as specced.
 */
function sanityCheck(totalScore, todayRow) {
  const readiness = isNum(todayRow?.readiness_score) ? Number(todayRow.readiness_score) : null;
  if (readiness == null) return { ouraReadiness: null, normalized: null, delta: null, flagged: false };
  const normalized = (readiness / 100) * WEARABLE_MAX;
  const delta = round(totalScore - normalized, 1);
  return { ouraReadiness: readiness, normalized: round(normalized, 1), delta, flagged: Math.abs(delta) > 20 };
}

/* ----------------------------------------------------------------- the API */

/**
 * Score one day.
 *
 * @param {object} today    the `wearable_daily` row being scored
 * @param {object[]} history  surrounding daily rows, any order, up to 20 days back
 * @returns the full result object — persisted verbatim on the member's daily record
 *          so the breakdown a member sees today is the one they saw at the time,
 *          not a recomputation against a baseline that has since moved.
 */
export function calculateWearableScore(today, history = []) {
  const { baselines, samples, historyDays, window } = computeBaselines(today, history);
  const confidence = confidenceFor(historyDays);

  const dailyMetrics = Object.entries(WEIGHTS.daily).map(([key, maxPoints]) => {
    const value = readMetric(today, key);
    const hasBaseline = isNum(baselines[key]) && samples[key] >= MIN_BASELINE_DAYS;
    return scoreMetric(key, value, baselines[key], maxPoints, hasBaseline);
  });

  const trendMetrics = scoreTrend(window, baselines, samples);

  const dailyScore = round(dailyMetrics.reduce((sum, m) => sum + m.points, 0), 1);
  const trendScore = round(trendMetrics.reduce((sum, m) => sum + m.points, 0), 1);
  const totalScore = round(dailyScore + trendScore, 1);
  const { label, token } = getScoreLabel(totalScore);

  const alerts = dailyMetrics.map((m) => m.alert).filter(Boolean);

  return {
    version: SCORE_VERSION,
    day: today?.day ?? null,
    totalScore,
    max: WEARABLE_MAX,
    dailyScore,
    dailyMax: DAILY_MAX,
    trendScore,
    trendMax: TREND_MAX,
    label,
    token,
    confidence,
    daily: dailyMetrics,
    trend: trendMetrics,
    baselines: Object.fromEntries(Object.entries(baselines).map(([k, v]) => [k, round(v, 1)])),
    baselineSamples: samples,
    alerts,
    sanityCheck: sanityCheck(totalScore, today),
    computedAt: new Date().toISOString(),
  };
}
