/**
 * Insight cards: the Home "today" card, the Records cross-panel insight and the Labs
 * findings.
 *
 * Written by the care team (agents/lib/review.mjs) since Oct 21 2026: every specialist
 * with data to read reviews the member's whole record from its side, they confer, and
 * My Advocate writes the cards under Dr. Locker's rules, the escalation lanes and the
 * GLP-1 label check, with the fact-checker and the code rules run on every card. This
 * module gathers what only the app knows (targets, the member's own messages, data
 * age, urgent patterns), sends it, and checks the cards once more on the way in.
 *
 * Urgency does not depend on the team. `detectUrgentPatterns` runs on the raw
 * snapshot first and its findings are returned whatever happens, so a critical
 * potassium escalates even if the service is down. There is no template fallback:
 * when the team can't answer, the card slots stay empty until it can.
 */
import { runAgentReview } from "./agentsClient";
import {
  availableDomains,
  conversationLines,
  dataFreshness,
  detectUrgentPatterns,
  hasFunctionalConcern,
  violatesForbiddenOutput,
} from "./clinicalRules";
import { MARKER_TARGETS, ageFromDob, formatTarget, markerIdFor, targetFor } from "./markerTargets";
import { markerStatus, statusLabel } from "./scorecard";

/**
 * The Thumbprint target for each marker on file, as the Biology screen shows it.
 * Handed to the model as fact so a card's "target" is the one the member sees next
 * to the number — never a range the model recalls from somewhere else. Uses the
 * bundled seed: the screen and the cards read the same values until the table is
 * revised, and a revision ships a new seed with it.
 */
function targetLines(labs = [], profile = {}) {
  const p = profile?.profile || profile || {};
  const who = { sex: p.sex, age: ageFromDob(p.dob) };
  const seen = new Set();
  const lines = [];
  for (const m of labs || []) {
    const markerId = markerIdFor(m?.name);
    if (!markerId || seen.has(markerId)) continue; // newest reading per marker only
    seen.add(markerId);
    const target = targetFor(MARKER_TARGETS, { markerId, unit: m.unit, ...who });
    if (!target) continue;
    const range = String(m.range || m.ref_range || "").trim();
    const status = markerStatus({ value: m.value, range, target });
    lines.push(`- ${m.name} ${m.value}${m.unit ? ` ${m.unit}` : ""}: lab range ${range || "not printed"}; Thumbprint target ${formatTarget(target)} (${target.evidence_level} evidence); ${statusLabel(status, { hasLabRange: Boolean(range) })}.`);
  }
  return lines.join("\n");
}

// Only these navigation targets exist, so the model can't invent a dead link. No
// store target: a health finding never links to something for sale (Adam Locker,
// Oct 19 2026: the recommendation and the sale are separate moments).
const ALLOWED_TARGETS = new Set(["discussion", "bodyfat_history"]);
const ALLOWED_ICONS = new Set(["alert", "moon", "activity", "sparkles"]);
const ALLOWED_SEVERITY = new Set(["danger", "warn", "info"]);

// Keep only actions whose target actually exists in the app.
function sanitizeAction(action) {
  if (!action || typeof action !== "object") return undefined;
  if (!action.label || !ALLOWED_TARGETS.has(action.target)) return undefined;
  return { label: String(action.label), target: action.target };
}

/**
 * Talk of a dose or a medication changing, with no number in it.
 *
 * Section 9's dosing check needs an amount ("5,000 IU"), so a card that told a
 * member to "explore possible treatment options or dosage adjustments" for their
 * vitamin D passed it — and put the idea of a dose change in front of them as the
 * takeaway. Kept to the cards (rather than added to the shared Section 9 list the
 * agents also run) because it is a rule about what an unprompted card may suggest.
 */
const DOSE_CHANGE_TALK = /\b(?:dos(?:e|age|ing)s?|medications?|prescriptions?)\s+(?:\w+\s+)?(?:adjust|chang|increas|decreas|tweak|modif|titrat)\w*|\b(?:adjust|chang|increas|decreas|rais|lower|tweak|modif|titrat|optimi[sz])\w*\s+(?:(?:your|the|their|a|any)\s+)?(?:\w+\s+)?(?:dos(?:e|age|ing)s?|medications?|prescriptions?)\b/i;

/**
 * Section 9, enforced again in the app. A card that still trips a forbidden pattern
 * is dropped rather than repaired: it is not one sentence away from being right.
 */
// The service has already traced every number to the record and the library; this
// second look in the app is the forbidden list and dose-change talk only.
function publishable(card, fields, guard) {
  const text = fields.map((f) => card?.[f]).filter(Boolean).join("\n");
  const why = violatesForbiddenOutput(text, guard)
    || (DOSE_CHANGE_TALK.test(text) ? "a hint that a dose or medication may change" : null);
  if (why) {
    console.warn(`Insight card suppressed — ${why}:`, card?.title);
    return false;
  }
  return true;
}

// `ai: true` on every card is how the UI knows to show the AI (sparkle) icon.
// Deterministic fallback cards never carry this flag, so they show a normal icon.
function sanitizeDaily(d, guard) {
  if (!d || typeof d !== "object" || !d.title || !d.body) return null;
  if (!publishable(d, ["title", "body", "basis"], guard)) return null;
  return {
    ai: true,
    type: "ai_daily",
    priority: Number.isFinite(d.priority) ? d.priority : (d.icon === "alert" ? 100 : 60),
    icon: ALLOWED_ICONS.has(d.icon) ? d.icon : "sparkles",
    title: String(d.title),
    body: String(d.body),
    // Rule 1.3 / 6.2 — which reference point this reading was judged against and
    // where the numbers came from. Without it a card is an assertion; with it the
    // member can check the working.
    basis: d.basis ? String(d.basis) : "",
    action: sanitizeAction(d.action),
  };
}

function sanitizeRecord(r, guard) {
  if (!r || typeof r !== "object" || !r.title || !r.body) return null;
  if (!publishable(r, ["title", "body", "basis", "doctorPath", "selfPayPath"], guard)) return null;
  return {
    ai: true,
    type: "ai_record",
    title: String(r.title),
    // Rule 2.4 — the physiological system the cluster belongs to, so a finding
    // reads as a system pattern rather than as an assortment of flagged rows.
    system: r.system ? String(r.system) : "",
    body: String(r.body),
    basis: r.basis ? String(r.basis) : "",
    doctorPath: r.doctorPath ? String(r.doctorPath) : "",
    selfPayPath: r.selfPayPath ? String(r.selfPayPath) : "",
  };
}

function sanitizeLabs(list, guard) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => l && l.title && l.body)
    .filter((l) => publishable(l, ["title", "body", "basis"], guard))
    .slice(0, 3)
    .map((l) => ({
      ai: true,
      title: String(l.title),
      body: String(l.body),
      basis: l.basis ? String(l.basis) : "",
      severity: ALLOWED_SEVERITY.has(l.severity) ? l.severity : "warn",
      action: sanitizeAction(l.action),
    }));
}

// One review per change to the record, not per screen load: the team is about a
// dozen model calls. Cached per member in this browser for a day; what the member
// says in chat refreshes the cards at most that often, a new lab, medication,
// check-in or answer at once.
const CACHE_KEY = "thumbprint.insights.v1";
const CACHE_MS = 24 * 60 * 60 * 1000;

function hashOf(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}
function readCache(key) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return c && c.key === key && Date.now() - c.at < CACHE_MS ? c.cards : null;
  } catch { return null; }
}
function writeCache(key, cards) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ key, at: Date.now(), cards })); } catch { /* storage off: the next load asks again */ }
}

/**
 * The insight cards for this member's record.
 *
 * @param {object}  healthData
 * @param {object}  profile
 * @param {object} [healthHistory]
 * @param {Array}  [messages]  the member's conversation, treated as longitudinal data
 * @param {string} [memberId]  keys the cache, so one browser never shows another member's cards
 * @returns {Promise<{urgent, recheck, daily, record, labs, lanes}|null>} null when the
 *   team can't answer and nothing is urgent; urgent findings are always returned.
 */
export async function generateAIInsights(healthData, profile, healthHistory = null, messages = [], memberId = "") {
  if (!healthData) return null;

  // Section 7, before anything else and independent of the team.
  const findings = detectUrgentPatterns({ healthData, messages });
  // "urgent" tells someone to be seen today; "recheck" is the same threshold crossed
  // by a reading too old to act on, said calmly.
  const urgent = findings.filter((f) => f.kind !== "recheck");
  const recheck = findings.filter((f) => f.kind === "recheck");
  const breadth = availableDomains(healthData, messages);
  const guard = { hasFunctionalConcern: hasFunctionalConcern(healthData) };
  // Nothing measured on file: every card is about getting the first data in.
  const firstData = !["bloodwork", "wearable", "uploaded documents"].some((d) => breadth.present.includes(d));

  const extras = {
    targets: targetLines(healthData?.labs, profile),
    conversation: conversationLines(messages),
    breadth: breadth.summary,
    freshness: dataFreshness(healthData).notes,
    urgent: urgent.map((u) => `${u.label}: ${u.message}`),
    recheck: recheck.map((u) => `${u.label}: ${u.source}`),
    firstData,
  };

  // The conversation is left out of the key: chat alone refreshes the cards daily.
  const key = `${memberId}:${hashOf(JSON.stringify([healthData?.labs, healthData?.today, healthData?.checkIns, healthData?.genetics, healthData?.records?.length, profile?.intake, profile?.medicationsDetail, profile?.schedule, profile?.completedItems, healthHistory, extras.targets, extras.urgent, extras.recheck]))}`;
  let cards = readCache(key);
  if (!cards) {
    try {
      cards = await runAgentReview({ task: "insights", userProfile: profile, healthData, healthHistory, extras });
      writeCache(key, cards);
    } catch (err) {
      console.warn("Insight review failed:", err?.message || err);
      return findings.length ? { urgent, recheck, daily: null, record: null, labs: [], lanes: [] } : null;
    }
  }
  return {
    urgent,
    recheck,
    daily: sanitizeDaily(cards.daily, guard),
    record: sanitizeRecord(cards.record, guard),
    labs: sanitizeLabs(cards.labs, guard),
    lanes: cards.lanes || [],
  };
}
