/**
 * Provider follow-ups: the rules, with no imports, so the agents test runner can
 * exercise them without a browser (agents/test/followups.test.mjs). The store that
 * reads and writes ghai.follow_ups is followUpStore.js.
 *
 * A care-team answer whose routing lanes put a marker in "Bring this to your
 * provider" opens one follow-up for that marker. The morning check-in asks about it
 * once when it is 30 days old and still open, and once more at 60 with "It's still
 * waiting". It never asks about more than one per morning: the check-in was cut to
 * three questions on member feedback, and a fourth only appears when one is due.
 */

export const FOLLOW_UP_QUESTION_ID = "followUp";
export const FOLLOW_UP_OPTIONS = ["Yes", "No", "Scheduled"];

// The member's tap → the follow-up's status. "No" keeps it open, so it comes back
// at 60 days.
const ANSWER_STATUS = { Yes: "discussed", No: "open", Scheduled: "scheduled" };

/** YYYY-MM-DD plus n days, in calendar days (no time-zone drift). */
export function addDays(day, n) {
  const [y, m, d] = String(day).slice(0, 10).split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const clip = (s, n) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/**
 * The follow-ups an answer should open, from its lane cards.
 *
 * One per provider-lane marker. Skipped when the member already has an open one for
 * that marker, or already closed one (discussed, scheduled, dismissed) for the SAME
 * reading: answering "Yes" must not be met by the same question a month later just
 * because they asked another question about the same old lab. A newer draw that
 * still lands in the provider lane opens a fresh one.
 *
 * @param {object[]} lanes     cards from lanesFor (agents/lib/escalation.mjs)
 * @param {object[]} existing  the member's follow_ups rows
 * @param {string}   today     the member's local day, YYYY-MM-DD
 * @returns {object[]} rows to insert
 */
export function followUpsFromLanes(lanes = [], existing = [], today) {
  const rows = [];
  const taken = new Set();
  for (const c of lanes || []) {
    if (c?.lane !== "provider" || !c.marker || taken.has(c.marker)) continue;
    taken.add(c.marker);
    const reading = c.date || null;
    const prior = (existing || []).filter((f) => f.marker === c.marker);
    if (prior.some((f) => f.status === "open")) continue;
    if (prior.some((f) => (f.reading_date || null) === reading)) continue;
    rows.push({
      marker: c.marker,
      marker_name: c.name || c.marker,
      lane_reason: clip(c.why, 500) || null,
      level: c.level === "immediate" ? "immediate" : "flag",
      reading: c.shown || null,
      reading_date: reading,
      status: "open",
      due_30: addDays(today, 30),
      due_60: addDays(today, 60),
    });
  }
  return rows;
}

/**
 * Which ask, if any, a follow-up is due for today: 30, 60 or null.
 * An open item is asked once at 30 days and once at 60; a "No" at 30 brings it back
 * at 60, and an answer at 60 ends the asking (the item stays open and on record).
 */
export function followUpStage(item, today) {
  if (!item || item.status !== "open") return null;
  const asked = item.last_asked_on || "";
  if (item.due_60 && today >= item.due_60) return asked >= item.due_60 ? null : 60;
  if (item.due_30 && today >= item.due_30) return asked >= item.due_30 ? null : 30;
  return null;
}

/** The one follow-up to ask about this morning: the oldest that is due, or null. */
export function dueFollowUp(items = [], today) {
  const due = (items || [])
    .map((item) => ({ item, stage: followUpStage(item, today) }))
    .filter((d) => d.stage)
    .sort((a, b) => String(a.item.due_30).localeCompare(String(b.item.due_30)));
  return due[0] || null;
}

/**
 * The marker as it reads mid-sentence: "your ferritin", "your fasting glucose", but
 * "your HbA1c", "your ApoB", "your Lp(a)", "your eGFR" keep their capitals.
 */
export function markerPhrase(name) {
  const s = String(name || "").trim();
  return /^[A-Z][a-z]+(?=[\s,]|$)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** The check-in question for a due follow-up, in checkInContent's question shape. */
export function followUpQuestion({ item, stage }) {
  const ask = `Have you had a chance to discuss your ${markerPhrase(item.marker_name || item.marker)} with your healthcare provider?`;
  return {
    id: FOLLOW_UP_QUESTION_ID,
    group: stage === 60 ? "Still open from your care team" : "From your care team",
    label: stage === 60 ? `It's still waiting. ${ask}` : ask,
    type: "choice",
    options: FOLLOW_UP_OPTIONS,
    followUpId: item.id,
    stage,
  };
}

/** The update a check-in answer writes to the follow-up. */
export function followUpAnswer(answer, today) {
  const status = ANSWER_STATUS[answer];
  if (!status) return null;
  return { status, last_answer: answer.toLowerCase(), last_asked_on: today };
}
