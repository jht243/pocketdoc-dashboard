/**
 * The wearable scoring engine, as the app sees it.
 *
 * The engine itself lives in `supabase/functions/_shared/wearableScore.ts` because
 * the sync worker is its authoritative caller — the score is computed and persisted
 * server-side on every sync. This re-export exists so the browser scores off the
 * exact same file when it needs to (a day synced before the rubric existed, or a
 * test-mode snapshot), instead of a second implementation that would drift.
 *
 * Import from here, never from the deep path.
 */

export {
  BASELINE_DAYS,
  DAILY_MAX,
  MIN_BASELINE_DAYS,
  METRIC_LABELS,
  SCORE_VERSION,
  TIER_MULTIPLIERS,
  TREND_DAYS,
  TREND_MAX,
  WEARABLE_MAX,
  WEIGHTS,
  calculateWearableScore,
  computeBaselines,
  confidenceFor,
  getMetricLabel,
  getScoreLabel,
} from "../../supabase/functions/_shared/wearableScore.js";
