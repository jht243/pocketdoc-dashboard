/**
 * Preventive care schedule engine.
 *
 * Baseline = USPSTF Grade A/B recommendations only, evaluated from age, sex, the
 * risk flags collected in onboarding and — for prediabetes / type 2 diabetes
 * screening — BMI from the health history's height and weight. Rules live in
 * `uspstfScreeningRules.json` so clinical content is not buried in UI code; the
 * matching itself is in screeningLogic.js, which has no imports so it can be unit
 * tested in Node.
 *
 * Not included (by design for this baseline):
 * - Grade C/D/I items (e.g. PSA is Grade C; clinician skin exam is I)
 * - Non-USPSTF sources (ACS, ATA, ACIP vaccines, dental/vision/hearing)
 * - Pregnancy-only and pediatric-only recommendations (we don't collect those states yet)
 */
import rules from "./uspstfScreeningRules.json";
import { buildScheduleFromRules, scheduleInputsFromIntake } from "./screeningLogic";

/**
 * @param {object} profile  { age, sex, risk flags }
 * @param {object} [intake] the health-history answers; height, weight and ancestry
 *                          decide whether diabetes screening applies
 */
function buildPreventiveCareSchedule(profile, intake) {
  return buildScheduleFromRules(rules, { ...profile, ...scheduleInputsFromIntake(intake) });
}

export { buildPreventiveCareSchedule };
export { rules as uspstfScreeningRules };
