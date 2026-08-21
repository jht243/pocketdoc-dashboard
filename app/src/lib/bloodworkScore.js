/**
 * The bloodwork scoring engine, as the app sees it.
 *
 * Same arrangement as lib/wearableScore.js: the engine lives under
 * `supabase/functions/_shared/` so server and browser share one copy rather than two
 * that drift. Import from here, never from the deep path.
 */

export {
  BLOODWORK_MAX,
  BLOODWORK_VERSION,
  MARKERS,
  MIN_COVERAGE_POINTS,
  PANELS,
  calculateBloodworkScore,
  getBloodworkLabel,
  missingMarkers,
} from "../../supabase/functions/_shared/bloodworkScore.js";
