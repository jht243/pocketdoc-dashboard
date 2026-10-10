/**
 * Morning check-in — questions, window, streak, and the reply.
 *
 * Source: the Morning Check-In feature spec (doc 19, Sep 24), the engagement model
 * (doc 14) and the Sep 30 call. Followed as a guide, not literally:
 *   - Three one-tap questions plus an optional 140-character note (doc 19 had nine;
 *     cut on member feedback, Oct 10).
 *   - Condition-based extras are rule-driven here (one example: thyroid medication).
 *     Adam's docs want an AI agent to choose them; that is a later phase, and every
 *     clinical question added here still needs Medical Director sign-off.
 *   - Window 5:00–11:00 local time; 2 skips per rolling 14 days keep the streak alive.
 */

export const WINDOW_OPEN_HOUR = 5;
export const WINDOW_CLOSE_HOUR = 11;
export const SKIPS_PER_14_DAYS = 2;
export const NOTE_MAX = 140;

// `scale` questions store 1–5; the two end labels are shown under the buttons.
// Three taps, then the optional note. Doc 19 asked for nine; members found that too
// long for a morning, so it is cut to the three signals that move most with the
// labs this app watches (sleep, energy, stress). The ids are unchanged, so earlier
// check-ins still read the same, and older answers (hours slept, mood and so on)
// still appear in a member's history and AI context when present.
export const BASE_QUESTIONS = [
  { id: "rested", group: "Sleep", label: "How well did you sleep?", type: "scale", low: "Poorly", high: "Great" },
  { id: "energy", group: "Energy", label: "How's your energy today?", type: "scale", low: "Drained", high: "Strong" },
  { id: "stress", group: "Stress", label: "How stressed do you feel?", type: "scale", low: "Calm", high: "Overwhelmed" },
];

export const NOTE_QUESTION = {
  id: "note", group: "Open field", label: "Anything you want your Thumbprint to know about today?",
  type: "note", placeholder: "e.g. started a new supplement, slept badly from travel, sick day…",
};

const THYROID_MEDS = /levothyroxine|synthroid|levoxyl|unithroid|euthyrox|tirosint|armour|np thyroid|nature-throid|liothyronine|cytomel/i;

/**
 * Extra questions triggered by what's on file. Each needs Medical Director sign-off
 * before it ships to members beyond beta (doc 10, AGT-28 question library).
 */
const PERSONAL_RULES = [
  {
    applies: ({ medNames }) => medNames.some((n) => THYROID_MEDS.test(n)),
    question: {
      id: "thyroidSymptoms", group: "Because you take thyroid medication",
      label: "Did you notice any of these yesterday?", type: "multi",
      options: ["Felt unusually cold", "Racing or pounding heart", "Brain fog", "Unusual hair shedding", "None of these"],
      exclusive: "None of these",
    },
  },
];

export function medicationNames(userProfile, healthData) {
  const rows = userProfile?.medicationsDetail?.length
    ? userProfile.medicationsDetail
    : healthData?.medications?.length ? healthData.medications : userProfile?.intake?.medications || [];
  return rows.map((m) => (typeof m === "string" ? m : m?.name)).filter(Boolean);
}

/** The full question list for this member today, in the order asked. */
export function checkInQuestions(userProfile, healthData) {
  const ctx = { medNames: medicationNames(userProfile, healthData) };
  const personal = PERSONAL_RULES.filter((r) => r.applies(ctx)).map((r) => r.question);
  return [...BASE_QUESTIONS, ...personal, NOTE_QUESTION];
}

/* ---------------- dates, window, streak ---------------- */

/** Local calendar date as YYYY-MM-DD. */
export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDay(day, delta) {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + delta));
}

/** "before" (not open yet), "open", or "closed" for the given moment. */
export function windowState(now = new Date()) {
  const h = now.getHours();
  if (h < WINDOW_OPEN_HOUR) return "before";
  if (h < WINDOW_CLOSE_HOUR) return "open";
  return "closed";
}

/** Skips used in the 14 days ending today. */
export function skipsUsed(checkIns = [], today = localDay()) {
  const from = shiftDay(today, -13);
  return checkIns.filter((c) => c.skipped && c.day >= from && c.day <= today).length;
}

/**
 * Consecutive days with a completed check-in. A skipped day keeps the streak alive
 * without adding to it; a day with nothing ends it. Today only counts once it's
 * done — before then the streak runs through yesterday, so it doesn't read as
 * broken at 6 AM.
 */
export function computeStreak(checkIns = [], today = localDay()) {
  const byDay = new Map(checkIns.map((c) => [c.day, c]));
  let day = byDay.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const c = byDay.get(day);
    if (!c) break;
    if (!c.skipped) streak += 1;
    day = shiftDay(day, -1);
  }
  return streak;
}

/* ---------------- the reply ---------------- */

const lastDays = (checkIns, today, n) => {
  const from = shiftDay(today, -(n - 1));
  return checkIns.filter((c) => !c.skipped && c.day >= from && c.day <= today).sort((a, b) => (a.day < b.day ? 1 : -1));
};

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * The deterministic one-sentence reply: used when the AI reply doesn't arrive inside
 * the 3-second budget or fails the forbidden-output check. Calm by design — it notes
 * patterns, never alarms, never diagnoses.
 */
export function fallbackReply(answers, checkIns = [], today = localDay()) {
  // Today's answers aren't saved yet when the reply is written; count them in.
  const withToday = [{ day: today, skipped: false, answers }, ...checkIns.filter((c) => c.day !== today)];
  const week = lastDays(withToday, today, 7);
  const poorSleep = week.filter((c) => Number(c.answers?.rested) > 0 && Number(c.answers.rested) <= 2).length;
  const lowEnergyRun = (() => {
    let n = 0;
    for (const c of week) { if (Number(c.answers?.energy) <= 2) n += 1; else break; }
    return n;
  })();
  const rested7 = avg(week.slice(1).map((c) => Number(c.answers?.rested)).filter(Boolean));

  if (lowEnergyRun >= 3) return `This is the ${ordinal(lowEnergyRun)} morning in a row with low energy. Keep logging it; if it continues, it's worth raising with your provider alongside your next blood panel.`;
  if (poorSleep >= 3) return `You've reported poor sleep ${poorSleep} times this week. That pattern is worth tracking before your next blood draw.`;
  if (Number(answers.rested) >= 4 && rested7 != null && Number(answers.rested) > rested7) return `Strong start: today's sleep score is above your recent average of ${rested7.toFixed(1)} out of 5.`;
  if (Number(answers.stress) >= 4) return "Logged. A high-stress morning is useful context for your health team. Be easy on yourself today.";
  const days = week.length;
  return days > 1
    ? `Logged. That's ${days} check-ins this week, and each one sharpens the picture before your next blood draw.`
    : "Logged. Each morning you check in builds the picture your bloodwork alone can't show.";
}

function ordinal(n) {
  return ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh"][n] || `${n}th`;
}

/** Plain-text summary of answers for the AI prompt and the health context. */
export function answerSummary(answers = {}, note = "") {
  const parts = [
    answers.sleepHours && `slept ${answers.sleepHours}h`,
    answers.rested && `sleep quality ${answers.rested}/5`,
    answers.nightWaking && `night waking: ${answers.nightWaking}`,
    answers.energy && `energy ${answers.energy}/5`,
    answers.hydration && `hydration: ${answers.hydration}`,
    answers.nutrition && `nutrition: ${answers.nutrition}`,
    answers.exercise && `exercise: ${answers.exercise}`,
    answers.stress && `stress ${answers.stress}/5`,
    answers.mood && `mood: ${answers.mood}`,
    answers.thyroidSymptoms?.length && `thyroid-related: ${answers.thyroidSymptoms.join(", ")}`,
    note && `note: "${note}"`,
  ].filter(Boolean);
  return parts.join("; ");
}

/** Lines for the AI's health context: recent averages plus each recent day. */
export function checkInContextLines(checkIns = [], today = localDay()) {
  const recent = lastDays(checkIns, today, 14);
  if (!recent.length) return "";
  const week = recent.filter((c) => c.day >= shiftDay(today, -6));
  const mean = (k) => avg(week.map((c) => Number(c.answers?.[k])).filter((v) => Number.isFinite(v) && v > 0));
  const fmt = (v) => (v == null ? "n/a" : v.toFixed(1));
  const head = `- 7-day averages (1-5 scales): sleep quality ${fmt(mean("rested"))}, energy ${fmt(mean("energy"))}, stress ${fmt(mean("stress"))}. Check-ins in last 7 days: ${week.length}. Streak: ${computeStreak(checkIns, today)} days.`;
  const rows = recent.map((c) => `- ${c.day}: ${answerSummary(c.answers, c.note)}`);
  return [head, ...rows].join("\n");
}
