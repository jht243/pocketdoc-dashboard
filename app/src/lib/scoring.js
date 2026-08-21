import { formatCompletedMonth, isScreeningDone } from "./screeningDates";
import { BLOODWORK_MAX, calculateBloodworkScore } from "./bloodworkScore";
import { WEARABLE_MAX } from "./wearableScore";

/**
 * The overall Health Score: three components, each worth 50 points.
 *
 *   Preventive care  50   whether the member is current on the screening their age
 *                         and history call for
 *   Wearable         50   raw biometrics scored against their own rolling baseline
 *                         (35 daily + 15 trend) — see lib/wearableScore.js
 *   Bloodwork        50   imported lab markers against absolute clinical thresholds
 *                         — see lib/bloodworkScore.js
 *
 * A component only enters the total once it has data behind it, and the denominator
 * moves with it. A member who has connected a ring but never uploaded labs is scored
 * out of 100, not out of 150 with 50 points they had no way to earn.
 *
 * Note what is NOT here any more. The daily ring used to score Oura's own sleep
 * score, Zone-2 minutes, the wake-up check-in and nutrition. The rubric replaces all
 * of it: composite vendor scores are sanity checks rather than inputs, and activity
 * is an input to the trend component only. Check-ins and nutrition are still tracked
 * and still drive recommendations — they just no longer carry points.
 */

const CATEGORY_WEIGHTS = { cancer: 10, cardiovascular: 9, metabolic: 8 };
const DEFAULT_WEIGHT = 8;

const COMPONENT_MAX = 50;

/**
 * The preventive-care half: coverage of the recommended screening schedule.
 *
 * Weighting: an overdue item and a never-started one score the same (zero) — this
 * answers "how much of your recommended screening is current", and a colonoscopy
 * you're two years late for is not partially current. Higher-stakes screenings carry
 * more weight than routine ones.
 */
function buildBaseItems(schedule = [], completedItems = {}) {
  return schedule.map((item) => {
    const value = completedItems[item.id];
    const done = isScreeningDone(value);
    const max = CATEGORY_WEIGHTS[item.category] || DEFAULT_WEIGHT;
    const month = done ? formatCompletedMonth(value) : null;

    return {
      name: item.name,
      status: done ? "current" : item.urgency === "overdue" ? "overdue" : "due",
      detail: done
        ? month ? `Completed ${month}` : "Marked complete"
        : item.urgency === "overdue" ? "Overdue" : `Due — ${item.frequency || "see schedule"}`,
      pts: done ? max : 0,
      max,
    };
  });
}

const round = (n) => Math.round(n * 10) / 10;

/**
 * @param {boolean} nutritionEnabled  retained for callers; nutrition is tracked and
 *                                    drives recommendations, but is not scored.
 * @param {object}  healthData        the snapshot every screen reads
 */
function useScoreModel(nutritionEnabled, healthData, userProfile) {
  const source = healthData?.score;
  const wearable = source?.wearable || null;
  const baseItems = source?.baseItems || [];

  // Normally already computed when the snapshot was assembled, so the ring, the
  // breakdown and the AI context all read one object. Computed here only for callers
  // that hand over labs without a prepared snapshot.
  // Sex changes the healthy band for HDL, ALT and ferritin, so it is passed through
  // rather than assumed; unknown falls back to neutral bands inside the engine.
  const bloodwork = source?.bloodwork
    || calculateBloodworkScore(healthData?.labs || [], { sex: userProfile?.profile?.sex });

  const hasPreventive = baseItems.length > 0;
  const hasWearable = Boolean(wearable);
  const hasBloodwork = bloodwork.available;

  if (!source || (!hasPreventive && !hasWearable && !hasBloodwork)) {
    return {
      hasData: false, baseItems: [], wearable: null, bloodwork,
      components: [], totalScore: 0, totalMax: 0,
    };
  }

  // Raw preventive points don't land on a round number (the schedule is weighted per
  // screening), so the component is expressed as its share of 50 — the same scale
  // every other component reports on.
  const preventiveTotal = baseItems.reduce((sum, item) => sum + item.pts, 0);
  const preventiveMax = baseItems.reduce((sum, item) => sum + item.max, 0);
  const preventiveDisplay = preventiveMax ? round((preventiveTotal / preventiveMax) * COMPONENT_MAX) : 0;

  const wearableDisplay = hasWearable ? wearable.totalScore : 0;

  const components = [
    hasPreventive && {
      key: "preventive",
      label: "Preventive care",
      sub: "Screening coverage for your age and history",
      points: preventiveDisplay,
      max: COMPONENT_MAX,
    },
    hasWearable && {
      key: "wearable",
      label: "Wearable",
      sub: `${wearable.label} — scored against your own baseline`,
      points: wearableDisplay,
      max: WEARABLE_MAX,
      confidence: wearable.confidence,
    },
    hasBloodwork && {
      key: "bloodwork",
      label: "Bloodwork",
      sub: `${bloodwork.label} — ${bloodwork.coverage.markers} markers, ${bloodwork.coverage.percent}% of the panel`,
      points: bloodwork.totalScore,
      max: BLOODWORK_MAX,
      confidence: bloodwork.confidence,
    },
  ].filter(Boolean);

  const totalScore = round(components.reduce((sum, c) => sum + c.points, 0));
  const totalMax = components.reduce((sum, c) => sum + c.max, 0);

  return {
    hasData: true,
    nutritionEnabled,
    baseItems,
    preventiveTotal,
    preventiveMax,
    preventiveDisplay,
    wearable,
    wearableDisplay,
    bloodwork,
    bloodworkDisplay: hasBloodwork ? bloodwork.totalScore : 0,
    components,
    totalScore,
    totalMax,
    // Kept so callers that still speak in rings don't have to know the component list.
    baseDisplay: preventiveDisplay,
    wearableRing: wearableDisplay,
  };
}

export { useScoreModel, buildBaseItems, COMPONENT_MAX };
