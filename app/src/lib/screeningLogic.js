/**
 * The rules behind the preventive care schedule, kept free of imports so the unit
 * tests (app/agents/test/screenings.test.mjs) can load them straight into Node.
 *
 * Four jobs live here:
 *   1. Building the schedule from the USPSTF rules, including the BMI criterion
 *      for prediabetes / type 2 diabetes screening.
 *   2. Reading height, weight and ancestry out of the health history.
 *   3. Turning "Which of the following have you completed?" answers into marks on
 *      the matching schedule items.
 *   4. Saying what state each item is in. "Overdue" is reserved for a screening
 *      whose recorded date has run past its interval; a screening we simply have no
 *      record of is "Not on file", because we don't know it hasn't been done.
 *
 * completedItems values (unchanged from screeningDates.js):
 *   falsy      → not on file
 *   true       → done, month unknown
 *   "YYYY-MM"  → done in that month
 */

/* ---------------- statuses ---------------- */

export const STATUS = {
  CURRENT: "current",
  DUE_SOON: "due_soon",
  OVERDUE: "overdue",
  NOT_ON_FILE: "not_on_file",
  CHECK_ELIGIBILITY: "check_eligibility",
};

export const STATUS_LABELS = {
  current: "Up to date",
  due_soon: "Due soon",
  overdue: "Overdue",
  not_on_file: "Not on file",
  check_eligibility: "Check eligibility",
};

// A recorded screening reads "Due soon" for the last three months of its interval
// (the due month itself and the two before it), so there is time to book it.
const DUE_SOON_MONTHS = 2;

const isDone = (value) => Boolean(value);

function monthIndex(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

const nowIndex = (now) => now.getFullYear() * 12 + now.getMonth();

/**
 * The month a recorded screening falls due again, as YYYY-MM-01, or null when it
 * can't be known (no date recorded, a one-time screen, or no fixed interval).
 */
export function nextDueDate(item, value) {
  if (!item || item.oneTime || !item.frequencyMonths) return null;
  const done = monthIndex(value);
  if (done == null) return null;
  const due = done + item.frequencyMonths;
  const y = Math.floor(due / 12);
  const m = String((due % 12) + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * One schedule item's state, given what the member has on file.
 *
 * Never-recorded items are "Not on file" (or "Check eligibility" when we can't yet
 * tell whether the recommendation applies). Recorded items are "Up to date" until
 * their interval runs out — "Due soon" near the end of it, "Overdue" after it. A
 * screening marked done with no month, or a one-time screen, stays up to date:
 * there's no date to measure an interval from.
 */
export function screeningStatus(item, value, now = new Date()) {
  if (!isDone(value)) {
    return item?.eligibility === "check" ? STATUS.CHECK_ELIGIBILITY : STATUS.NOT_ON_FILE;
  }
  if (value === true || item?.oneTime || !item?.frequencyMonths) return STATUS.CURRENT;
  const done = monthIndex(value);
  if (done == null) return STATUS.CURRENT;
  const monthsLeft = done + item.frequencyMonths - nowIndex(now);
  if (monthsLeft < 0) return STATUS.OVERDUE;
  if (monthsLeft <= DUE_SOON_MONTHS) return STATUS.DUE_SOON;
  return STATUS.CURRENT;
}

/** Counts by status across a schedule — what the Home chip and headers read. */
export function summarizeSchedule(schedule = [], completedItems = {}, now = new Date()) {
  const counts = { current: 0, due_soon: 0, overdue: 0, not_on_file: 0, check_eligibility: 0, recorded: 0, total: 0 };
  for (const item of schedule) {
    const value = completedItems?.[item.id];
    counts[screeningStatus(item, value, now)] += 1;
    if (isDone(value)) counts.recorded += 1;
    counts.total += 1;
  }
  return counts;
}

/**
 * The value written to `ghai.screenings.urgency`. The column's check constraint
 * allows only overdue / due_soon / upcoming / done, so the two "we don't know yet"
 * states are written as null rather than failing the whole upsert.
 */
export function dbUrgency(item, value, now = new Date()) {
  if (isDone(value)) return "done";
  const status = screeningStatus(item, value, now);
  return status === STATUS.OVERDUE || status === STATUS.DUE_SOON ? status : null;
}

/* ---------------- body size from the health history ---------------- */

const num = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
};

/**
 * Height in cm from the intake's height answer: the two-input object the form saves
 * ({ unit, feet, inches, cm }), or a legacy free-typed string ("5'10", "178 cm").
 * Null when it can't be read or falls outside a plausible adult range.
 */
export function parseHeightCm(height) {
  let cm = null;
  if (height && typeof height === "object") {
    if (height.unit === "metric") cm = num(height.cm);
    else {
      const feet = num(height.feet);
      const inches = num(height.inches) ?? 0;
      if (feet != null) cm = (feet * 12 + inches) * 2.54;
      else if (num(height.inches) != null) cm = num(height.inches) * 2.54;
    }
  } else if (typeof height === "string" || typeof height === "number") {
    const text = String(height).toLowerCase().trim();
    const metric = /(\d+(?:\.\d+)?)\s*cm/.exec(text);
    const meters = /^(\d(?:\.\d+)?)\s*m$/.exec(text);
    const imperial = /(\d+(?:\.\d+)?)\s*(?:'|’|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|”|''|in|inch|inches)?)?/.exec(text);
    const inchesOnly = /^(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)$/.exec(text);
    if (metric) cm = Number(metric[1]);
    else if (meters) cm = Number(meters[1]) * 100;
    else if (imperial) cm = (Number(imperial[1]) * 12 + (imperial[2] ? Number(imperial[2]) : 0)) * 2.54;
    else if (inchesOnly) cm = Number(inchesOnly[1]) * 2.54;
    else {
      const bare = num(text);
      // A bare number: centimetres if it reads like one, else not guessable.
      if (bare != null && bare >= 120 && bare <= 230) cm = bare;
    }
  }
  if (cm == null || cm < 120 || cm > 230) return null;
  return cm;
}

/**
 * Weight in kg from the intake's free-text weight ("175 lbs", "80 kg", "175").
 * A bare number is read as pounds — the field's own placeholder is "e.g. 175 lbs".
 */
export function parseWeightKg(weight) {
  if (weight == null || weight === "") return null;
  const text = String(weight).toLowerCase().trim();
  const m = /(\d+(?:[.,]\d+)?)/.exec(text);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  const kg = /kg|kilo/.test(text) ? value
    : /\bst\b|stone/.test(text) ? value * 6.35029
    : value * 0.45359237;
  if (!Number.isFinite(kg) || kg < 30 || kg > 350) return null;
  return kg;
}

/** BMI to one decimal from the health history, or null when height or weight is missing. */
export function bmiFromIntake(intake = {}) {
  const cm = parseHeightCm(intake?.height);
  const kg = parseWeightKg(intake?.weight);
  if (cm == null || kg == null) return null;
  const m = cm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

/**
 * Whether the member reports Asian ancestry. The intake's option is the combined
 * "Asian / Pacific Islander", so that is what counts; USPSTF uses a BMI of 23 rather
 * than 25 for Asian American adults.
 */
export function reportsAsianAncestry(intake = {}) {
  const list = Array.isArray(intake?.raceEthnicity) ? intake.raceEthnicity : [];
  return list.some((v) => /\basian\b/i.test(String(v)));
}

/** What the schedule needs from the health history, beyond age, sex and risk flags. */
export function scheduleInputsFromIntake(intake = {}) {
  return { bmi: bmiFromIntake(intake), asianAncestry: reportsAsianAncestry(intake) };
}

/* ---------------- the schedule ---------------- */

const RISK_FLAGS = ["smoker", "familyEarlyHeartDisease", "familyOrPersonalCancer", "diabetesOrPrediabetes"];

function matchesAge(rule, age) {
  if (age == null || Number.isNaN(age)) return false;
  if (rule.startAge != null && age < rule.startAge) return false;
  if (rule.maxAge != null && age > rule.maxAge) return false;
  return true;
}

function matchesRisk(rule, profile) {
  return (rule.requires || []).every((flag) => RISK_FLAGS.includes(flag) && !!profile[flag]);
}

/**
 * Body-size criterion (prediabetes / type 2 diabetes): "met" when the BMI is at or
 * above the threshold, "unmet" when it is known and below, "check" when height or
 * weight hasn't been given yet — listed, but as a question rather than a to-do.
 */
function bmiEligibility(rule, profile) {
  if (rule.bmiMin == null) return "met";
  const bmi = profile.bmi;
  if (bmi == null || Number.isNaN(bmi)) return "check";
  const threshold = profile.asianAncestry && rule.bmiMinAsian != null ? rule.bmiMinAsian : rule.bmiMin;
  return bmi >= threshold ? "met" : "unmet";
}

/**
 * Build the member's schedule from the USPSTF rule list.
 *
 * @param {object[]} rules    uspstfScreeningRules.json
 * @param {object}   profile  { age, sex, risk flags, bmi?, asianAncestry? }
 */
export function buildScheduleFromRules(rules = [], profile = {}) {
  const items = [];
  for (const rule of rules) {
    if (rule.sex && rule.sex !== profile.sex) continue;
    if (!matchesAge(rule, profile.age)) continue;
    if (!matchesRisk(rule, profile)) continue;
    const eligibility = bmiEligibility(rule, profile);
    if (eligibility === "unmet") continue;

    items.push({
      id: rule.id,
      category: rule.category,
      name: rule.name,
      frequency: rule.frequency,
      startAge: rule.startAge,
      note: eligibility === "check" && rule.eligibilityNote ? rule.eligibilityNote : rule.note,
      grade: rule.grade,
      sourceYear: rule.sourceYear,
      frequencyMonths: rule.frequencyMonths,
      oneTime: !!rule.oneTime,
      eligibility,
      // The item's state before anything is on file. Kept under the old field name
      // for the readers that still look at it; screeningStatus() is the live answer.
      urgency: eligibility === "check" ? STATUS.CHECK_ELIGIBILITY : STATUS.NOT_ON_FILE,
    });
  }
  return items;
}

/* ---------------- health history → schedule ---------------- */

// Health-history options ("Which of the following have you completed?") that match
// a USPSTF schedule item. Matched on keywords rather than the exact option string so
// a wording tweak in intakeContent.js doesn't silently break the link. Options with
// no schedule item (PSA is Grade C, a skin exam is Grade I, CAC, genetic tests …)
// stay health-history facts only.
const INTAKE_TO_SCHEDULE = [
  { match: /colonoscopy|colorectal|sigmoidoscopy|\bfit\b|stool dna/i, id: "colonoscopy" },
  { match: /mammogram/i, id: "mammogram" },
  { match: /pap smear|cervical/i, id: "pap" },
  { match: /bone density|dexa/i, id: "dexa" },
  { match: /low-dose ct|\bldct\b/i, id: "lung_ct" },
];

/** Schedule ids named by a list of health-history screening answers. */
export function intakeScreeningIds(options = []) {
  const ids = new Set();
  for (const option of Array.isArray(options) ? options : []) {
    for (const { match, id } of INTAKE_TO_SCHEDULE) if (match.test(String(option))) ids.add(id);
  }
  return ids;
}

/**
 * Carry health-history screening answers onto the schedule.
 *
 * A screening ticked in the health history marks its schedule item done (no month,
 * unless one is already recorded). `applied` remembers which items the health
 * history has already marked, so each tick is applied once: if the member later
 * clears that item on Preventive care, their choice stands and the old answer
 * doesn't keep re-marking it. Unticking in the health history never un-marks the
 * schedule — it only forgets the item, so ticking it again marks it again.
 *
 * @returns {{ completedItems, applied: string[], changed: boolean, appliedChanged: boolean }}
 */
export function applyIntakeScreenings({ schedule = [], completedItems = {}, screeningsCompleted = [], applied = [] }) {
  const ticked = intakeScreeningIds(screeningsCompleted);
  const onSchedule = new Set(schedule.map((item) => item.id));
  const before = new Set(Array.isArray(applied) ? applied : []);
  const next = { ...(completedItems || {}) };
  let changed = false;

  const nextApplied = [...before].filter((id) => ticked.has(id));
  for (const id of ticked) {
    // Not on this member's schedule yet (say, colonoscopy at 44): leave it unapplied
    // so it lands the day the item appears.
    if (!onSchedule.has(id) || before.has(id)) continue;
    if (!isDone(next[id])) {
      next[id] = true;
      changed = true;
    }
    nextApplied.push(id);
  }

  const appliedChanged = nextApplied.length !== before.size || nextApplied.some((id) => !before.has(id));
  return { completedItems: next, applied: nextApplied.sort(), changed, appliedChanged };
}
