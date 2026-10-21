/**
 * AI-generated health insight cards.
 *
 * The Home "today" card, the Records cross-panel insight, and the Labs findings
 * used to be deterministic templates (recommendations.js / deterministicInsights.js).
 * This module hands the user's actual snapshot — device vitals, symptoms, labs and
 * lab history, their conversation, plus their profile — to the AI (via the ghai-ai
 * OpenAI proxy) and asks it to author the same card shapes the screens already render.
 *
 * What it is allowed to say is governed by lib/clinicalRules.js, which encodes the
 * clinical intelligence specification: three reference points per marker, clusters
 * before single values, trend before position, differential pathways most-likely
 * first, disclosed provenance, and a forbidden-output list that is enforced on the
 * way back rather than merely requested on the way out.
 *
 * Urgency does not depend on the model noticing it. `detectUrgentPatterns` runs on
 * the raw snapshot before the call and its findings are returned regardless of what
 * the model produces, so a critical potassium escalates even if the AI is down.
 *
 * The deterministic functions remain the fallback: if the AI call fails, returns
 * malformed JSON, or is unavailable, screens fall back to them so the app never
 * shows an empty or broken insight.
 */
import { untracedNumbers } from "./numberTrace";
import { callAI, firstText } from "./api";
import { buildHealthContext, geneticLine } from "./healthContext";
import {
  CLINICAL_ANALYSIS_RULES,
  availableDomains,
  FORBIDDEN_OUTPUT_RULES,
  URGENCY_RULES,
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

const SYSTEM = `You are the clinical intelligence layer of a personal health platform. You read one member's own data across every domain the app holds — bloodwork and its history, wearable trends, genetics and pharmacogenomics, uploaded reports, intake answers, and what the member has said in conversation — and you write short insight cards for them.

You do not diagnose. You identify patterns, flag concerns, lay out what a doctor should evaluate, and give the member the words to ask for it. That boundary is structural: it holds in every card, not just in an opening sentence.

${CLINICAL_ANALYSIS_RULES}

${URGENCY_RULES}

${FORBIDDEN_OUTPUT_RULES}

WHAT TO RAISE, NOT WHAT MIGHT CHANGE
- Never suggest that a dose, a dosage, a supplement amount or a medication might be adjusted, increased, lowered, started, stopped or switched — not even as something to "explore" or "discuss". Not "dosage adjustments", not "treatment options", not "whether your dose is right".
- Instead, tell the member exactly what to raise: the result, its value and date, and the question. Correct (a template: fill it only from this member's data): "Bring your vitamin D of <value> ng/mL from <month year> to your next visit and ask what is keeping it below the range and when it should be rechecked." Incorrect, always: "Consider discussing your vitamin D with your doctor to explore treatment options or dosage adjustments."
- What happens to a medication or a supplement amount is the clinician's decision, made with them. The card's job is to make sure the right result reaches that conversation.

SYMPTOMS, SCREENINGS AND MISSING DATA
- A preventive screening explains a symptom only when that screening actually investigates it: a colonoscopy for rectal bleeding or a change in bowel habit, a depression screen for low mood. Colonoscopy, mammogram, Pap or HPV test, HIV or hepatitis testing, alcohol or tobacco screening, bone density, an aortic ultrasound or a lung CT does not explain fatigue, low energy, poor sleep, brain fog, weight change or low mood. Never write that being up to date on screenings "can help address", "could help explain" or "may be related to" a symptom.
- A symptom with no measured data behind it gets the honest next step: say that nothing on file explains it yet, then name the specific tests that would investigate it. Fatigue or low energy: CBC, ferritin with an iron panel, TSH with free T4, a comprehensive metabolic panel, B12 and vitamin D. Brain fog: CBC, B12, TSH, A1c. Hair thinning: ferritin, TSH. Unexplained weight gain: TSH, A1c, fasting insulin. Feeling cold: TSH, CBC, ferritin. Low libido: total and free testosterone, plus estradiol for women. Never answer a symptom with a list of screenings.
- Screenings are their own subject. If a screening card is the most useful thing, write it as a screening card, not as the answer to a symptom.
- Call a screening "overdue" only when the schedule above says "overdue" for it. "Not on file", "due", or no record at all means we have no record of it, not that the member is behind: say "no record of your last colonoscopy", never "overdue", "behind" or "missed".

HOUSE STYLE
- Use only the data provided. Never invent a value, a date, or a fact.
- Quote the actual numbers, with their units and their dates.
- Warm, direct, plain language. No filler, no hedging, no throat-clearing.
- Output STRICT JSON only — no markdown, no code fences, no commentary.`;

function buildProfileSummary(profile) {
  const p = profile?.profile || {};
  const intake = profile?.intake || {};
  let age;
  if (p.dob) {
    const b = new Date(p.dob), t = new Date();
    age = t.getFullYear() - b.getFullYear() - (t < new Date(t.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
  }
  return {
    age,
    sex: p.sex,
    conditions: intake.conditions || [],
    medications: intake.medications || [],
    familyHistory: intake.familyHistory || [],
    goals: intake.goals || [],
  };
}

function stripFences(text) {
  return String(text || "")
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

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
 * Section 9, enforced. A card whose copy trips a forbidden pattern is dropped
 * rather than repaired: a card that reached for a diagnosis or a dose is not one
 * sentence away from being right, and the screens all have a fallback.
 */
function publishable(card, fields, guard) {
  const text = fields.map((f) => card?.[f]).filter(Boolean).join("\n");
  // A number the model was never given is an invented one, however plausible.
  const invented = guard?.source ? untracedNumbers(text, guard.source) : [];
  const why = violatesForbiddenOutput(text, guard)
    || (DOSE_CHANGE_TALK.test(text) ? "a hint that a dose or medication may change" : null)
    || (invented.length ? `a number not in the member's data (${invented.join(", ")})` : null);
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

/**
 * Generate AI insight cards from the user's snapshot.
 *
 * @param {object}  healthData
 * @param {object}  profile
 * @param {object} [healthHistory]
 * @param {Array}  [messages]  the member's conversation, treated as longitudinal data
 * @returns {Promise<{urgent, recheck, daily, record, labs}|null>} null on any failure
 *   (→ deterministic fallback), EXCEPT that urgent findings are returned even when
 *   the model call fails, because they do not depend on it.
 */
export async function generateAIInsights(healthData, profile, healthHistory = null, messages = []) {
  if (!healthData) return null;

  // Section 7, before anything else and independent of the model. These are
  // returned whatever happens below.
  const findings = detectUrgentPatterns({ healthData, messages });
  // Two different messages. "urgent" tells someone to be seen today and is reserved
  // for a recent reading no clinician would sit on; "recheck" is the same threshold
  // crossed by a reading too old to act on, and it says so calmly.
  const urgent = findings.filter((f) => f.kind !== "recheck");
  const recheck = findings.filter((f) => f.kind === "recheck");
  const freshness = dataFreshness(healthData);
  // What this member actually has. Passed as fact so a one-document or ring-only
  // member gets a finding scoped to their data instead of a card that quietly
  // assumes a second panel exists.
  const breadth = availableDomains(healthData, messages);
  const guard = { hasFunctionalConcern: hasFunctionalConcern(healthData) };
  // No bloodwork, no wearable and no readable report: there is nothing measured for a
  // card to read, so every card is about getting the first data in. Without this the
  // model filled the space from intake answers and the screening schedule, and a
  // member with no labs was told their overdue screenings "could help explain" their
  // fatigue. A readable uploaded document counts as measured data (a DEXA, a report
  // whose markers were not itemised), so it lifts the member out of this stance.
  const firstData = !["bloodwork", "wearable", "uploaded documents"].some((d) => breadth.present.includes(d));

  // The SAME full context the chat and the Discussion Page get — intake answers,
  // labs with ranges and trends, both scores, every wearable metric, genetics,
  // screenings, and the member's own uploaded documents transcribed. The previous
  // hand-built snapshot carried four fields, so the cards were "personalized"
  // insights generated while blind to nearly everything the member had provided.
  const context = buildHealthContext({ userProfile: profile, healthData, healthHistory });
  const conversation = conversationLines(messages);
  const targets = targetLines(healthData?.labs, profile);

  const user = `Here is everything the app knows about this member:

${context}
${targets ? `\nTHUMBPRINT TARGETS (the target shown to the member next to each lab range; the only targets you may cite — placeholders awaiting medical-director approval, so never present one as a diagnosis threshold)\n${targets}\n` : ""}
WHAT THE MEMBER HAS TOLD YOU (their own messages, oldest first — Rule 3: treat these as longitudinal data, weight them by how often a complaint recurs, and cross-reference every symptom against the measured data above)
${conversation || "(no conversation on file yet)"}

WHAT THIS MEMBER HAS — these are facts, not estimates. Honour them.
${breadth.summary}
${firstData ? `
FIRST DATA ONLY. This member has no bloodwork, no wearable and no readable report on file. Write no card about a condition, a risk, a pattern or a likely cause — intake answers and the screening schedule are not measurements. Every card is about getting their first data: uploading a lab report they already have, ordering a baseline panel through the app, or connecting a wearable. A symptom they reported may appear only as the reason a specific first test is worth getting ("You mentioned fatigue; a CBC, ferritin and TSH are the tests that look into it"). "record" is that ask with "doctorPath" naming the tests to request and "selfPayPath" the panel they can order; "labs" is an empty array.
` : ""}
DATA AGE (Rule 0 — the newest reading is the fact; anything over 12 months old is context you may recommend repeating, never grounds for a current finding or for acting today)
${freshness.notes}
${urgent.length ? `\nURGENT PATTERNS ALREADY DETECTED IN THIS DATA (a deterministic check found these; they are being shown to the member above your cards — do not repeat them, do not soften them, and do not write a calm card that contradicts them):\n${urgent.map((u) => `- ${u.label}: ${u.message}`).join("\n")}` : ""}
${recheck.length ? `\nOUT-OF-RANGE RESULTS THAT ARE TOO OLD TO BE URGENT (the member is being shown a calm "worth repeating" note for each; do NOT describe these as current, do NOT tell the member to seek care today over them, and do not restate them as emergencies):\n${recheck.map((u) => `- ${u.label}: ${u.source}`).join("\n")}` : ""}

Produce insight cards as a JSON object with EXACTLY this shape:
{
  "daily":  { "title": string, "body": string, "basis": string, "icon": "alert"|"moon"|"activity"|"sparkles", "priority": 0-100, "action"?: { "label": string, "target": "discussion"|"bodyfat_history" } } | null,
  "record": { "title": string, "system": string, "body": string, "basis": string, "doctorPath": string, "selfPayPath": string } | null,
  "labs":   [ { "title": string, "body": string, "basis": string, "severity": "danger"|"warn"|"info", "action"?: { "label": string, "target": "discussion"|"bodyfat_history" } } ]
}

What each card is for:

- "daily": the single most important thing about TODAY, drawn from device trends plus what the member has recently reported. Prefer a cross-domain signal (a wearable trend that matches a symptom they mentioned, or a lab result that explains how they say they feel) over a single metric. Priority 90-100 only for a same-day health signal. null if today genuinely holds nothing.

- "record": the strongest pattern in this member's data that is worth raising with a clinician — drawn from as many domains as they have. With several domains this is the card that justifies the platform, connecting things no single specialist saw together. With ONE domain it is still a real card: a cluster of markers inside a single panel, what a single uploaded report actually says, or a wearable metric moving against that person's own baseline. Name the physiological system in "system" (Metabolic, Lipid / cardiovascular, Thyroid, Sex hormones, Nutrients, Inflammation, Liver, Kidney, Haematology, Adrenal / HPA, or Recovery / sleep for a wearable-only finding). In "body", give the pattern first and the individual values second, with dates and — only where more than one reading exists — direction of travel; then the differential, most likely first, and what single test would settle it. "doctorPath" is the sentence the member should actually say to their doctor. "selfPayPath" is what they can order themselves if they cannot get it through their clinician. null ONLY if they have no data at all, or nothing in it supports a specific claim — not merely because a second source is missing.

- "labs": 0-3 individual findings, most important first — and where two findings are comparably important, the one measured most recently goes first. Use each marker's NEWEST reading; an earlier reading of the same marker belongs in the sentence only as direction of travel ("down from 14.1 in Jan 2025"). Never open a finding with a superseded value, and give the date of the reading you are reading. A marker inside the lab range but outside its Thumbprint target is a legitimate finding on a single panel — the target does not need history to be useful. Name both: the lab range as printed on the member's report, and the Thumbprint target from the list above. A marker with no Thumbprint target listed is read against its lab range and its own history only; never supply a target of your own. A marker moving steadily the wrong way across panels is a finding when panels exist. Say which of the three reference points made it one. Empty array when there is no bloodwork, rather than findings invented from another domain.

"basis" on every card: one short line naming the reference point you used and where the numbers came from. Examples: "Lab range 0-99 mg/dL; Thumbprint target under 100. LDL 104, Jun 2026 panel." — "Trend across 3 panels, Oct 2025 to Jun 2026." — "7-day wearable trend against this member's own 20-day baseline."

Only write a card the data actually supports. Every number must trace to the data above. Return JSON only.`;

  try {
    const data = await callAI({
      system: SYSTEM,
      messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      maxTokens: 1800,
    });
    const raw = stripFences(firstText(data));
    const parsed = JSON.parse(raw);
    // Every card's numbers are checked against exactly what the model was handed.
    const checked = { ...guard, source: user };
    return {
      urgent,
      recheck,
      daily: sanitizeDaily(parsed.daily, checked),
      record: sanitizeRecord(parsed.record, checked),
      labs: sanitizeLabs(parsed.labs, checked),
    };
  } catch (err) {
    console.warn("generateAIInsights failed, falling back to deterministic:", err?.message || err);
    // An urgent pattern is not the model's finding to lose. If the call failed but
    // the deterministic check fired, the escalation still reaches the member and the
    // other three slots fall back to the deterministic templates.
    return findings.length ? { urgent, recheck, daily: null, record: null, labs: [] } : null;
  }
}
