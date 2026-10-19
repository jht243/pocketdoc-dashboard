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
