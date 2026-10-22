/**
 * GLP-1 weight-loss medication: who may be a candidate, decided in code.
 *
 * Source: Dr. Locker, Oct 21 2026 call (13:18–14:54) and his BMI email the same day.
 *  - The FDA labels for the weight-loss GLP-1s (Wegovy, Zepbound) are written around
 *    BMI 30 or higher, or BMI 27 or higher with at least one weight-related
 *    condition: high blood pressure, type 2 diabetes, high cholesterol, sleep apnea.
 *    Insurers use the same cut-offs. BMI is calculated in the background for this;
 *    the member is shown waist-based numbers, not BMI.
 *  - "The app never recommends a GLP-1 on its own. If someone meets the criteria, it
 *    flags them for a clinician: 'You may be a candidate for weight-loss medication.
 *    Let's review it with your clinician.'"
 *  - Screen for the main safety exclusions: personal or family history of medullary
 *    thyroid cancer or MEN2, pregnancy or trying to conceive, history of
 *    pancreatitis. Anyone with one of these goes straight to the clinician.
 *
 * The agents are handed the result (healthContext.js "weight" section) and the
 * provider-lane card (`glp1LaneCard`); no model decides eligibility. Pure: imported by
 * the browser and by the agents service under plain node, hence the .js extensions.
 */
import { bmiFromIntake } from "./screeningLogic.js";

export const GLP1_BMI_ALONE = 30;
export const GLP1_BMI_WITH_CONDITION = 27;

/** The member-facing words, exactly as Dr. Locker wrote them. */
export const GLP1_FLAG_LINE = "You may be a candidate for weight-loss medication. Let's review it with your clinician.";

/** Weight-related conditions on the label, as the intake's condition list names them. */
const WEIGHT_CONDITIONS = [
  { label: "high blood pressure", re: /high blood pressure|hypertension/i },
  { label: "type 2 diabetes", re: /type 2 diabetes/i },
  { label: "high cholesterol", re: /high cholesterol|dyslipid/i },
  { label: "sleep apnea", re: /sleep apn/i },
];

/**
 * The exclusion questions (intakeContent.js, "Weight-loss medication safety"), each
 * with what a "yes" means. An unanswered one is listed as unanswered, never assumed.
 */
export const GLP1_EXCLUSIONS = [
  { id: "mtcHistory", label: "personal or family history of medullary thyroid cancer or MEN2" },
  { id: "pancreatitisHistory", label: "history of pancreatitis" },
  { id: "tryingToConceive", label: "pregnant or trying to conceive", femaleOnly: true },
];

const yes = (v) => /^yes/i.test(String(v || ""));
// "Not sure" is not a "no": it stays on the clinician's list of things to settle.
const answered = (v) => v != null && String(v).trim() !== "" && !/^not sure/i.test(String(v));
const isFemale = (sex) => String(sex || "").toLowerCase() === "female";

/**
 * @param {object} intake  health-history answers (height, weight, conditions, pregnancy,
 *                         and the exclusion questions)
 * @param {string} [sex]   "male" | "female"
 * @returns {{
 *   status: "unknown" | "not_candidate" | "candidate" | "clinician_only",
 *   bmi: number|null, criterion: string|null, conditions: string[],
 *   exclusions: string[], unanswered: string[]
 * }}
 *   unknown         no BMI (height or weight missing): nothing can be said
 *   not_candidate   below both label thresholds
 *   candidate       meets the label: flag for the clinician with GLP1_FLAG_LINE
 *   clinician_only  meets the label but has a safety exclusion: straight to the
 *                   clinician, and the app says nothing about being a candidate
 */
export function glp1Eligibility(intake = {}, sex) {
  const bmi = bmiFromIntake(intake);
  const conditionText = [...(Array.isArray(intake?.conditions) ? intake.conditions : [])].join(" | ");
  const conditions = WEIGHT_CONDITIONS.filter((c) => c.re.test(conditionText)).map((c) => c.label);
  const applicable = GLP1_EXCLUSIONS.filter((e) => !e.femaleOnly || isFemale(sex));
  const exclusions = applicable.filter((e) => yes(intake?.[e.id])).map((e) => e.label);
  if (isFemale(sex) && intake?.pregnancy === "Pregnant" && !exclusions.includes("pregnant or trying to conceive")) {
    exclusions.push("pregnant or trying to conceive");
  }
  const unanswered = applicable.filter((e) => !answered(intake?.[e.id])).map((e) => e.label);
  const base = { bmi, conditions, exclusions, unanswered };

  if (bmi == null) return { ...base, status: "unknown", criterion: null };
  const criterion = bmi >= GLP1_BMI_ALONE
    ? `BMI ${bmi} (${GLP1_BMI_ALONE} or higher)`
    : bmi >= GLP1_BMI_WITH_CONDITION && conditions.length
      ? `BMI ${bmi} (${GLP1_BMI_WITH_CONDITION} or higher) with ${conditions.join(", ")}`
      : null;
  if (!criterion) return { ...base, status: "not_candidate", criterion: null };
  return { ...base, status: exclusions.length ? "clinician_only" : "candidate", criterion };
}

/**
 * The result as a "Bring this to your provider" lane card, the shape
 * agents/lib/escalation.mjs gives a lab marker, so the chat's lanes, the provider
 * follow-ups (followUps.js) and compose all carry it with no new path. Null when the
 * member doesn't meet the label.
 */
export function glp1LaneCard(result) {
  if (!result || (result.status !== "candidate" && result.status !== "clinician_only")) return null;
  const excluded = result.status === "clinician_only";
  return {
    marker: "glp1_review",
    name: "Weight-loss medication review",
    domain: "weight",
    lane: "provider",
    label: "Bring this to your provider",
    level: "flag",
    trigger: "GLP1",
    shown: `BMI ${result.bmi}`,
    date: null,
    why: excluded
      ? `Meets the weight-loss GLP-1 label criteria (${result.criterion}) but reports ${result.exclusions.join(" and ")}, a safety exclusion: this goes to the clinician, and the app does not describe the member as a candidate.`
      : `Meets the weight-loss GLP-1 label criteria (${result.criterion}). The clinician decides; the app never recommends the medication.${result.unanswered.length ? ` Safety questions not yet settled (unanswered or "not sure"): ${result.unanswered.join("; ")}.` : ""}`,
  };
}

/** The intake answers glp1Eligibility reads, and nothing else: what the agents service is sent. */
export function glp1Inputs(intake = {}) {
  const keys = ["height", "weight", "conditions", "pregnancy", ...GLP1_EXCLUSIONS.map((e) => e.id)];
  return Object.fromEntries(keys.filter((k) => intake?.[k] !== undefined).map((k) => [k, intake[k]]));
}

/** The result as the record section the agents read (healthContext.js "weight"). */
export function glp1Lines(result) {
  if (!result || result.status === "unknown") {
    return "- GLP-1 eligibility: cannot be assessed (height or weight not on file).";
  }
  const lines = [];
  if (result.status === "not_candidate") {
    lines.push(`- GLP-1 eligibility (decided in code from the FDA label): does not meet the label criteria (BMI ${result.bmi}${result.conditions.length ? `, with ${result.conditions.join(", ")}` : ""}). Do not raise weight-loss medication as something they qualify for.`);
  } else if (result.status === "candidate") {
    lines.push(`- GLP-1 eligibility (decided in code from the FDA label): MEETS the label criteria, ${result.criterion}. If weight, weight loss or medication for weight comes up, say exactly: "${GLP1_FLAG_LINE}" Never recommend the medication, name a drug as right for them, or give a dose: the clinician decides.`);
  } else {
    lines.push(`- GLP-1 eligibility (decided in code from the FDA label): meets the label criteria (${result.criterion}) BUT reports ${result.exclusions.join(" and ")}, a safety exclusion. Never describe them as a candidate. If weight medication comes up, say this has to be reviewed with their clinician because of that history.`);
  }
  if (result.unanswered.length && result.status !== "not_candidate") {
    lines.push(`- Safety questions not yet settled (unanswered or "not sure"): ${result.unanswered.join("; ")}. The clinician will need these.`);
  }
  return lines.join("\n");
}
