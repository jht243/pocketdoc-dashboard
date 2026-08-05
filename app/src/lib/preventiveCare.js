/**
 * Preventive care schedule engine.
 *
 * Baseline = USPSTF Grade A/B recommendations only, evaluated from age, sex,
 * and the risk flags collected in onboarding. Rules live in
 * `uspstfScreeningRules.json` so clinical content is not buried in UI code.
 *
 * Not included (by design for this baseline):
 * - Grade C/D/I items (e.g. PSA is Grade C; clinician skin exam is I)
 * - Non-USPSTF sources (ACS, ATA, ACIP vaccines, dental/vision/hearing)
 * - Pregnancy-only and pediatric-only recommendations (we don't collect those states yet)
 */
import rules from "./uspstfScreeningRules.json";

const RISK_FLAGS = ["smoker", "familyEarlyHeartDisease", "familyOrPersonalCancer", "diabetesOrPrediabetes"];

function matchesSex(rule, sex) {
  if (!rule.sex) return true;
  return rule.sex === sex;
}

function matchesAge(rule, age) {
  if (age == null || Number.isNaN(age)) return false;
  if (rule.startAge != null && age < rule.startAge) return false;
  if (rule.maxAge != null && age > rule.maxAge) return false;
  return true;
}

function matchesRisk(rule, profile) {
  const required = rule.requires || [];
  return required.every((flag) => {
    if (!RISK_FLAGS.includes(flag)) return false;
    return !!profile[flag];
  });
}

/**
 * Heuristic urgency until due dates are derived from completed_at + frequency.
 * One-time screens that already apply are due_soon; recurring items past start
 * age + a small buffer trend toward overdue.
 */
function urgencyFor(rule, age) {
  if (rule.oneTime) return "due_soon";
  if (rule.startAge == null) return "due_soon";
  if (age >= rule.startAge + 2) return "overdue";
  if (age >= rule.startAge) return "due_soon";
  return "upcoming";
}

function buildPreventiveCareSchedule(profile) {
  const { age, sex } = profile;
  const items = [];

  for (const rule of rules) {
    if (!matchesSex(rule, sex)) continue;
    if (!matchesAge(rule, age)) continue;
    if (!matchesRisk(rule, profile)) continue;

    items.push({
      id: rule.id,
      category: rule.category,
      name: rule.name,
      frequency: rule.frequency,
      startAge: rule.startAge,
      note: rule.note,
      grade: rule.grade,
      sourceYear: rule.sourceYear,
      frequencyMonths: rule.frequencyMonths,
      oneTime: !!rule.oneTime,
      urgency: urgencyFor(rule, age),
    });
  }

  return items;
}

export { buildPreventiveCareSchedule };
export { rules as uspstfScreeningRules };
