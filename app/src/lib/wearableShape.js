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
    skinTempDeviation: num(latest.temp_deviation_c),
    sleepEfficiency: num(latest.sleep_efficiency),
    spo2: num(latest.spo2_percent),
    totalSleepMinutes: num(latest.total_sleep_minutes),
    steps: num(latest.steps),
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
    history: rows,
  };
}
