/**
 * Biological age (Levine PhenoAge), as the app sees it.
 *
 * Same arrangement as lib/bloodworkScore.js: the calculator lives under
 * `supabase/functions/_shared/` so server and browser share one copy rather than two
 * that drift. Import from here, never from the deep path.
 */

export {
  CRP_ACUTE_MG_L,
  PHENOAGE_AGE_RANGE,
  PHENOAGE_COEFFICIENTS,
  PHENOAGE_GAMMA,
  PHENOAGE_MARKERS,
  PHENOAGE_VERSION,
  SIMULATOR_TARGETS,
  TREND_NOISE_YEARS,
  aboutYears,
  ageOnDate,
  bioAgeFromLabs,
  calculatePhenoAge,
  formatYears,
  groupDraws,
  improvementLabel,
  markerForRow,
  phenoAgeFormula,
  roundToHalf,
  simulateLevers,
  simulateScenario,
  toModelUnits,
} from "../../supabase/functions/_shared/phenoAge.js";

/**
 * Whether biological age is shown at all.
 *
 * Off for members until the medical director signs off on the model and the
 * simulator targets. Two ways on: `VITE_BIO_AGE=1` at build time (a preview deploy),
 * or `localStorage["tp:bioAge"] = "1"` in one browser — which is how Adam previews it
 * on the live app without any member seeing it. Storage can throw (private mode,
 * blocked site data); that reads as off.
 */
export function bioAgeEnabled() {
  if (import.meta.env?.VITE_BIO_AGE === "1") return true;
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("tp:bioAge") === "1";
  } catch {
    return false;
  }
}
