/**
 * Body-size measures from the health history's height, weight and waist.
 *
 * Dr. Locker, Oct 21 2026 call and BMI email: BMI is "a very s***** system", so the
 * member sees the waist-based numbers (relative fat mass and waist-to-height ratio).
 * BMI is still calculated, in the background only, because prescribing eligibility
 * (the GLP-1 labels) and the USPSTF diabetes screening are written around it.
 */
import { bmiFromIntake, parseHeightCm, parseWaistCm, parseWeightKg } from "./screeningLogic.js";

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Relative fat mass (Woolcott & Bergman, Sci Rep 2018): an estimate of whole-body
 * fat percentage from height, waist and sex, validated against DXA.
 *   RFM = 64 − 20 × (height / waist) + 12 × sex   (sex: 0 male, 1 female)
 * Null without all three, since the formula has no sex-neutral form.
 */
export function relativeFatMass(heightCm, waistCm, sex) {
  if (heightCm == null || waistCm == null) return null;
  if (sex !== "male" && sex !== "female") return null;
  return round1(64 - 20 * (heightCm / waistCm) + (sex === "female" ? 12 : 0));
}

/**
 * Every measure the app can work out from what the member entered. Missing inputs
 * give null for whatever depends on them, never an estimate.
 *
 * @param {object} intake   health-history answers (height, weight, waist)
 * @param {string} [sex]    "male" | "female" from the profile
 * @returns {{ heightCm, weightKg, waistCm, bmi, rfm, waistToHeight }}
 */
export function bodyMetrics(intake = {}, sex) {
  const heightCm = parseHeightCm(intake?.height);
  const weightKg = parseWeightKg(intake?.weight);
  const waistCm = parseWaistCm(intake?.waist);
  return {
    heightCm,
    weightKg,
    waistCm,
    bmi: bmiFromIntake(intake),
    rfm: relativeFatMass(heightCm, waistCm, sex),
    waistToHeight: heightCm != null && waistCm != null ? round2(waistCm / heightCm) : null,
  };
}

/** Whether height and weight are both readable, the two onboarding asks for before moving on. */
export function hasHeightAndWeight(intake = {}) {
  return parseHeightCm(intake?.height) != null && parseWeightKg(intake?.weight) != null;
}
