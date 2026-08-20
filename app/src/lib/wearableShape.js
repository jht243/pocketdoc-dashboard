/**
 * Pure shaping: `wearable_daily` rows → the `healthData` slice the screens read.
 *
 * Split out from wearableStore.js so it can be exercised without a Supabase client.
 * Nothing here touches the network or the DOM.
 *
 * Deliberately vendor-neutral — no field name here says "Oura".
 */

// Days of history used for baselines. Long enough to survive a bad week, short
// enough to track a real change in fitness.
export const BASELINE_DAYS = 14;
// Below this many prior days, a "baseline" is noise wearing a confident label — the
// UI shows the raw value with no comparison until there is enough history.
export const MIN_BASELINE_SAMPLES = 7;

export function median(values) {
  const sorted = values
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Trailing median for one field, EXCLUDING the current day.
 *
 * Oura reports no baselines of its own — every "vs baseline" string in the UI is
 * computed here. Median rather than mean because one travel night or one fever
 * shouldn't drag the reference point the user is then judged against.
 * `rows` must be newest-first. Returns null when history is too thin to be honest.
 */
export function baselineFor(rows, field) {
  const priors = rows
    .slice(1, BASELINE_DAYS + 1)
    .map((r) => r[field])
    .filter((v) => v != null)
    .map(Number);
  if (priors.length < MIN_BASELINE_SAMPLES) return null;
  return median(priors);
}

const num = (v) => (v == null ? null : Number(v));

/**
 * One vitals chip's comparison line.
 * `invert` marks metrics where lower is better (resting HR): a rise is the
 * concerning direction there, whereas for HRV it's a fall.
 */
export function deltaLabel(value, baseline, invert = false) {
  if (value == null || baseline == null) return { sub: null, color: "neutral" };
  const diff = value - baseline;
  if (Math.abs(diff) < 0.5) return { sub: "At your baseline", color: "neutral" };
  const worse = invert ? diff > 0 : diff < 0;
  const rounded = Math.abs(Math.round(diff * 10) / 10);
  return {
    sub: `${diff > 0 ? "+" : "−"}${rounded} vs baseline`,
    color: worse ? "warning" : "neutral",
  };
}

export function buildVitals(today, baselines) {
  const vitals = [];

  if (today.hrv != null) {
    const d = deltaLabel(today.hrv, baselines.hrv);
    vitals.push({ label: "HRV", value: `${Math.round(today.hrv)}ms`, sub: d.sub, color: d.color });
  }
  if (today.restingHR != null) {
    const d = deltaLabel(today.restingHR, baselines.restingHR, true);
    vitals.push({ label: "RHR", value: `${Math.round(today.restingHR)} bpm`, sub: d.sub, color: d.color });
  }
  if (today.readiness != null) {
    const typical = baselines.readiness;
    const below = typical != null && today.readiness < typical - 3;
    vitals.push({
      label: "Readiness",
      value: String(today.readiness),
      sub: typical == null ? null : below ? "Below typical" : "Typical",
      color: below ? "warning" : "neutral",
    });
  }

  // Home renders these side by side in one fixed row; past three it stops being a
  // glance and starts being a table.
  return vitals.slice(0, 3);
}

export function sleepNoteFor(row) {
  if (row?.sleep_score == null) return "No sleep data yet";
  if (row.sleep_score >= 85) return "Strong night";
  if (row.sleep_score >= 70) return "Good night last night";
  if (row.sleep_score >= 55) return "Restless night";
  return "Poor night — go easy today";
}

export function strainFrom(activityScore) {
  if (activityScore == null) return null;
  if (activityScore >= 85) return "high";
  if (activityScore >= 70) return "moderate";
  return "low";
}

/**
 * Every biometric we persist to `wearable_daily`, with how to label and format it.
 *
 * Single source of truth for the "All collected metrics" expander on the Body screen:
 * the range list is generated from this so a field added to the sync mapping shows up
 * without touching the screen. `scale` divides the stored value before display
 * (sleep_efficiency is a 0-1 fraction shown as a percent); `format: "hm"` renders
 * minutes as `Xh Ym`.
 */
export const WEARABLE_METRICS = [
  { key: "readiness_score", label: "Readiness", unit: "" },
  { key: "sleep_score", label: "Sleep score", unit: "" },
  { key: "activity_score", label: "Activity score", unit: "" },
  { key: "hrv_ms", label: "HRV", unit: "ms" },
  { key: "resting_hr", label: "Resting heart rate", unit: "bpm" },
  { key: "average_hr", label: "Avg heart rate (sleep)", unit: "bpm" },
  { key: "total_sleep_minutes", label: "Total sleep", unit: "", format: "hm" },
  { key: "deep_sleep_minutes", label: "Deep sleep", unit: "", format: "hm" },
  { key: "rem_sleep_minutes", label: "REM sleep", unit: "", format: "hm" },
  { key: "awake_minutes", label: "Awake time", unit: "min" },
  { key: "sleep_efficiency", label: "Sleep efficiency", unit: "%", scale: 100 },
  { key: "spo2_percent", label: "Blood oxygen (SpO₂)", unit: "%" },
  { key: "temp_deviation_c", label: "Skin temp deviation", unit: "°C" },
  { key: "steps", label: "Steps", unit: "" },
  { key: "active_calories", label: "Active calories", unit: "kcal" },
  { key: "medium_activity_minutes", label: "Medium activity", unit: "min" },
  { key: "high_activity_minutes", label: "High activity", unit: "min" },
  { key: "zone2_minutes", label: "Active minutes (MET 4+)", unit: "min" },
];

/** Minutes → "7h 32m" / "48m". */
export function formatHoursMinutes(mins) {
  if (mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Format one metric's raw stored value for display (applies scale + format). */
export function formatMetricValue(metric, raw) {
  if (raw == null) return null;
  const scaled = metric.scale ? raw * metric.scale : raw;
  if (metric.format === "hm") return formatHoursMinutes(scaled);
  const rounded = Math.round(scaled * 10) / 10;
  return metric.unit ? `${rounded}${metric.unit === "%" ? "" : " "}${metric.unit}` : String(rounded);
}

/**
 * For every collected metric, the latest reading plus its range over the loaded
 * window (min / median / max). Powers the collapsed "All collected metrics" list —
 * "not by default" is a UI concern; this just supplies the numbers.
 * `rows` newest-first. Metrics with no data in the window are omitted.
 */
export function buildMetricRanges(rows) {
  if (!rows?.length) return [];
  const [latest] = rows;
  return WEARABLE_METRICS.map((metric) => {
    const values = rows
      .map((r) => r[metric.key])
      .filter((v) => v != null)
      .map(Number);
    if (!values.length) return null;
    const current = latest[metric.key] != null ? Number(latest[metric.key]) : null;
    return {
      key: metric.key,
      label: metric.label,
      current: current == null ? null : formatMetricValue(metric, current),
      low: formatMetricValue(metric, Math.min(...values)),
      typical: formatMetricValue(metric, median(values)),
      high: formatMetricValue(metric, Math.max(...values)),
      samples: values.length,
    };
  }).filter(Boolean);
}

/**
 * Rows (newest first) → `{ today, vitals, score, history }`, or null when empty.
 */
export function toSnapshot(rows) {
  if (!rows?.length) return null;
  const [latest] = rows;
  const yesterday = rows[1];

  const today = {
    day: latest.day,
    readiness: num(latest.readiness_score),
    hrv: num(latest.hrv_ms),
    restingHR: num(latest.resting_hr),
    averageHR: num(latest.average_hr),
    skinTempDeviation: num(latest.temp_deviation_c),
    spo2: num(latest.spo2_percent),

    // Sleep detail
    sleepScore: num(latest.sleep_score),
    sleepEfficiency: num(latest.sleep_efficiency),
    totalSleepMinutes: num(latest.total_sleep_minutes),
    deepSleepMinutes: num(latest.deep_sleep_minutes),
    remSleepMinutes: num(latest.rem_sleep_minutes),
    awakeMinutes: num(latest.awake_minutes),

    // Activity detail
    activityScore: num(latest.activity_score),
    steps: num(latest.steps),
    activeCalories: num(latest.active_calories),
    mediumActivityMinutes: num(latest.medium_activity_minutes),
    highActivityMinutes: num(latest.high_activity_minutes),
    zone2Minutes: num(latest.zone2_minutes),

    strainYesterday: strainFrom(num(yesterday?.activity_score)),
    zone2MinutesPlanned: 30,
  };

  const baselines = {
    hrv: baselineFor(rows, "hrv_ms"),
    restingHR: baselineFor(rows, "resting_hr"),
    readiness: baselineFor(rows, "readiness_score"),
  };

  // AIChatScreen builds a "HRV 42ms (baseline 50)" line straight off `today`, so the
  // baselines are surfaced there under the exact names that prompt already uses.
  today.hrvBaseline = baselines.hrv;
  today.restingHRBaseline = baselines.restingHR;
  today.readinessTypical = baselines.readiness;

  return {
    today,
    vitals: buildVitals(today, baselines),
    score: {
      sleepScore: num(latest.sleep_score),
      sleepNote: sleepNoteFor(latest),
      // Derived from activity bands, not a measured heart-rate zone — see
      // functions/_shared/oura.ts. Named for what scoring.js already consumes.
      zone2Minutes: num(latest.zone2_minutes) ?? 0,
    },
    // Latest reading + trailing range for every collected metric — the Body screen's
    // collapsed "All collected metrics" list renders straight off this.
    metrics: buildMetricRanges(rows),
    history: rows,
  };
}
