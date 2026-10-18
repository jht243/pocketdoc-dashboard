/**
 * What the Health Score is made of, in words — for this member, right now.
 *
 * Every surface that explains the score (Home's dial, the score breakdown, the Care
 * tab's nutrition setting) reads its wording from here. They used to each carry
 * their own sentence and drifted apart: one described "the wearable part" to
 * members with no wearable, one said the score was screenings plus wearable, and
 * one said bloodwork wasn't live. Built from the same flags the score model uses,
 * so the words can only say what the number is actually counting.
 *
 * No imports, so it can be unit tested in Node.
 */

const PREVENTIVE = "preventive care — whether you're current on the screenings recommended for your age and history";
const WEARABLE = "your wearable readings, measured against your own baseline";
const BLOODWORK = "your bloodwork, measured against published clinical thresholds";

function joinList(parts) {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join("; ")}; and ${parts[parts.length - 1]}`;
}

/**
 * @param {object} flags
 * @param {boolean} flags.hasSchedule       the member has a preventive care schedule
 * @param {boolean} flags.preventiveCounted at least one screening is on file
 * @param {boolean} flags.wearableConnected a wearable is connected and scored
 * @param {boolean} flags.bloodworkScored   enough of a panel to score
 * @returns {{
 *   scored: boolean,       any component counts today
 *   counted: string[],     component keys in the total
 *   sentence: string,      one paragraph for the breakdown and the Care tab
 *   footnote: string|null, the short caveat under the dial
 *   startHint: string|null the one thing that starts the score, when nothing counts yet
 * }}
 */
export function describeScore({ hasSchedule = false, preventiveCounted = false, wearableConnected = false, bloodworkScored = false } = {}) {
  const counted = [];
  const parts = [];
  if (hasSchedule && preventiveCounted) { counted.push("preventive"); parts.push(PREVENTIVE); }
  if (wearableConnected) { counted.push("wearable"); parts.push(WEARABLE); }
  if (bloodworkScored) { counted.push("bloodwork"); parts.push(BLOODWORK); }

  const notes = [];
  if (hasSchedule && !preventiveCounted) {
    notes.push("Preventive care starts counting once you mark a screening you've had.");
  }
  if (!bloodworkScored) {
    notes.push("Bloodwork isn't scored yet, so it isn't counted for or against you.");
  }

  const lead = counted.length
    ? `Your Health Score is built from ${joinList(parts)}.`
    : "Your Health Score isn't scored yet — nothing on file can be scored so far.";

  return {
    scored: counted.length > 0,
    counted,
    sentence: [lead, ...notes].join(" "),
    footnote: notes.length ? notes.join(" ") : null,
    startHint: counted.length ? null
      : hasSchedule ? "Mark the screenings you've had" : null,
  };
}
