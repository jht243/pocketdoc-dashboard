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

// Only these navigation targets exist, so the model can't invent a dead link.
const ALLOWED_TARGETS = new Set(["iv", "vitd3", "discussion", "bodyfat_history"]);
const ALLOWED_ICONS = new Set(["alert", "moon", "activity", "sparkles"]);
const ALLOWED_SEVERITY = new Set(["danger", "warn", "info"]);

const SYSTEM = `You are the clinical intelligence layer of a personal health platform. You read one member's own data across every domain the app holds — bloodwork and its history, wearable trends, genetics and pharmacogenomics, uploaded reports, intake answers, and what the member has said in conversation — and you write short insight cards for them.

You do not diagnose. You identify patterns, flag concerns, lay out what a doctor should evaluate, and give the member the words to ask for it. That boundary is structural: it holds in every card, not just in an opening sentence.

${CLINICAL_ANALYSIS_RULES}

${URGENCY_RULES}

${FORBIDDEN_OUTPUT_RULES}

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
 * Section 9, enforced. A card whose copy trips a forbidden pattern is dropped
 * rather than repaired: a card that reached for a diagnosis or a dose is not one
 * sentence away from being right, and the screens all have a fallback.
 */
function publishable(card, fields, guard) {
  const text = fields.map((f) => card?.[f]).filter(Boolean).join("\n");
  const why = violatesForbiddenOutput(text, guard);
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

  // The SAME full context the chat and the Discussion Page get — intake answers,
  // labs with ranges and trends, both scores, every wearable metric, genetics,
  // screenings, and the member's own uploaded documents transcribed. The previous
  // hand-built snapshot carried four fields, so the cards were "personalized"
  // insights generated while blind to nearly everything the member had provided.
  const context = buildHealthContext({ userProfile: profile, healthData, healthHistory });
  const conversation = conversationLines(messages);

  const user = `Here is everything the app knows about this member:

${context}

WHAT THE MEMBER HAS TOLD YOU (their own messages, oldest first — Rule 3: treat these as longitudinal data, weight them by how often a complaint recurs, and cross-reference every symptom against the measured data above)
${conversation || "(no conversation on file yet)"}

WHAT THIS MEMBER HAS — these are facts, not estimates. Honour them.
${breadth.summary}

DATA AGE (Rule 0 — the newest reading is the fact; anything over 12 months old is context you may recommend repeating, never grounds for a current finding or for acting today)
${freshness.notes}
${urgent.length ? `\nURGENT PATTERNS ALREADY DETECTED IN THIS DATA (a deterministic check found these; they are being shown to the member above your cards — do not repeat them, do not soften them, and do not write a calm card that contradicts them):\n${urgent.map((u) => `- ${u.label}: ${u.message}`).join("\n")}` : ""}
${recheck.length ? `\nOUT-OF-RANGE RESULTS THAT ARE TOO OLD TO BE URGENT (the member is being shown a calm "worth repeating" note for each; do NOT describe these as current, do NOT tell the member to seek care today over them, and do not restate them as emergencies):\n${recheck.map((u) => `- ${u.label}: ${u.source}`).join("\n")}` : ""}

Produce insight cards as a JSON object with EXACTLY this shape:
{
  "daily":  { "title": string, "body": string, "basis": string, "icon": "alert"|"moon"|"activity"|"sparkles", "priority": 0-100, "action"?: { "label": string, "target": "iv"|"vitd3"|"discussion"|"bodyfat_history" } } | null,
  "record": { "title": string, "system": string, "body": string, "basis": string, "doctorPath": string, "selfPayPath": string } | null,
  "labs":   [ { "title": string, "body": string, "basis": string, "severity": "danger"|"warn"|"info", "action"?: { "label": string, "target": "iv"|"vitd3"|"discussion"|"bodyfat_history" } } ]
}

What each card is for:

- "daily": the single most important thing about TODAY, drawn from device trends plus what the member has recently reported. Prefer a cross-domain signal (a wearable trend that matches a symptom they mentioned, or a lab result that explains how they say they feel) over a single metric. Priority 90-100 only for a same-day health signal. null if today genuinely holds nothing.

- "record": the strongest pattern in this member's data that is worth raising with a clinician — drawn from as many domains as they have. With several domains this is the card that justifies the platform, connecting things no single specialist saw together. With ONE domain it is still a real card: a cluster of markers inside a single panel, what a single uploaded report actually says, or a wearable metric moving against that person's own baseline. Name the physiological system in "system" (Metabolic, Lipid / cardiovascular, Thyroid, Sex hormones, Nutrients, Inflammation, Liver, Kidney, Haematology, Adrenal / HPA, or Recovery / sleep for a wearable-only finding). In "body", give the pattern first and the individual values second, with dates and — only where more than one reading exists — direction of travel; then the differential, most likely first, and what single test would settle it. "doctorPath" is the sentence the member should actually say to their doctor. "selfPayPath" is what they can order themselves if they cannot get it through their clinician. null ONLY if they have no data at all, or nothing in it supports a specific claim — not merely because a second source is missing.

- "labs": 0-3 individual findings, most important first — and where two findings are comparably important, the one measured most recently goes first. Use each marker's NEWEST reading; an earlier reading of the same marker belongs in the sentence only as direction of travel ("down from 14.1 in Jan 2025"). Never open a finding with a superseded value, and give the date of the reading you are reading. A marker inside the lab range but outside the functional range is a legitimate finding on a single panel — the functional range does not need history to be useful. A marker moving steadily the wrong way across panels is a finding when panels exist. Say which of the three reference points made it one. Empty array when there is no bloodwork, rather than findings invented from another domain.

"basis" on every card: one short line naming the reference point you used and where the numbers came from. Examples: "Lab range 0.5-4.5 mIU/L; functional target 1.0-2.0. TSH 3.1, Jun 2026 panel." — "Trend across 3 panels, Apr 2025 to Jan 2026." — "7-day wearable trend against this member's own 20-day baseline."

Only write a card the data actually supports. Every number must trace to the data above. Return JSON only.`;

  try {
    const data = await callAI({
      system: SYSTEM,
      messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      maxTokens: 1800,
    });
    const raw = stripFences(firstText(data));
    const parsed = JSON.parse(raw);
    return {
      urgent,
      recheck,
      daily: sanitizeDaily(parsed.daily, guard),
      record: sanitizeRecord(parsed.record, guard),
      labs: sanitizeLabs(parsed.labs, guard),
    };
  } catch (err) {
    console.warn("generateAIInsights failed, falling back to deterministic:", err?.message || err);
    // An urgent pattern is not the model's finding to lose. If the call failed but
    // the deterministic check fired, the escalation still reaches the member and the
    // other three slots fall back to the deterministic templates.
    return findings.length ? { urgent, recheck, daily: null, record: null, labs: [] } : null;
  }
}

/**
 * Suggest over-the-counter supplements based on the member's own measured data.
 *
 * Rule 4.1 and Section 9 bar the genetic-variant-to-supplement pipeline outright: a
 * variant may explain a biomarker, but it can never on its own justify a product.
 * So genetics is supplied here as interpretive context for a marker, and a
 * suggestion that rests on a variant with no biomarker behind it is rejected.
 *
 * Returns [{name, keywords, reason}] — `keywords` is an Amazon search string the
 * caller uses to pull real product cards. OTC supplements only, never prescription
 * drugs, and never a dose. [] on any failure.
 */
export async function suggestSupplements(profile, healthData = null) {
  const p = buildProfileSummary(profile);
  const meds = profile?.medicationsDetail?.length
    ? profile.medicationsDetail.map((m) => [m.name, m.dose, m.frequency, m.type].filter(Boolean).join(" "))
    : profile?.intake?.medications || [];

  // The member's measured data, compacted: suggesting supplements while blind to
  // their labs recommends nothing for a measured deficiency — the one case where a
  // supplement suggestion is actually grounded. A full in-range panel is summarized
  // as such so the model doesn't treat "no data" and "all normal" alike.
  const flagged = (healthData?.labs || []).filter((l) => l.status && l.status !== "normal" && l.status !== "unknown");
  const labSummary = flagged.length
    ? flagged.map((l) => `${l.name} ${l.value}${l.unit ? " " + l.unit : ""} (${l.status}${l.range ? ", ref " + l.range : ""}${l.date ? ", " + l.date : ""})`).join("; ")
    : healthData?.labs?.length
      ? "all markers on file within range"
      : "no lab results on file";
  const genetics = (healthData?.genetics || []).map(geneticLine).join("\n");
  const freshness = dataFreshness(healthData);
  const breadth = availableDomains(healthData);

  const system = `You suggest OVER-THE-COUNTER supplements for one member, grounded in their own measured results.

Rules, in force regardless of how the data looks:
- OTC supplements only. Never prescription medications, hormones, peptides, or controlled substances.
- NEVER give a dose or an amount. Not "2,000 IU", not "a high-dose form", not a range. You say what a supplement is for and which of this member's results points at it; the amount is their clinician's decision.
- A genetic variant is CONTEXT, never a reason on its own. You may cite a variant only to explain a measured biomarker that already justifies the suggestion. A suggestion whose only support is a variant is forbidden — omit it.
- Ground every suggestion in a specific measured result and name that result in the reason. A goal-based suggestion is acceptable only when no measured result speaks to it, and must say that it is goal-based rather than measured.
- If the member's bloodwork is more than 12 months old, do not treat it as current: say the marker needs re-testing instead of suggesting a product against a stale value.
- Never duplicate a supplement or medication they already take.
- Check their medications before suggesting anything that interacts with one. If there is a plausible interaction, say so in the reason rather than dropping the suggestion silently.
- Never diagnose. Never tell them to change a medication.
- Output STRICT JSON only.`;

  const user = `Member profile: ${JSON.stringify({ ...p, currentMeds: meds })}

Out-of-range / notable lab results: ${labSummary}
What this member has on file: ${breadth.summary}
Data age: ${freshness.notes}
${genetics ? `\nGenetics on file (CONTEXT ONLY — never the sole basis for a suggestion):\n${genetics}\n` : ""}
Return JSON: { "suggestions": [ { "name": string, "keywords": string, "reason": string } ] }
- 0 to 4 suggestions, best-grounded first. Return an empty array rather than padding with generic ones.
- "keywords": a concise Amazon search query (e.g. "vitamin d3 k2 supplement"). No dose in the query.
- "reason": one sentence naming the specific result it rests on. No dose.
Return JSON only.`;

  try {
    const data = await callAI({ system, messages: [{ role: "user", content: [{ type: "text", text: user }] }], maxTokens: 600 });
    const parsed = JSON.parse(stripFences(firstText(data)));
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions
      .filter((s) => s && s.name && s.keywords)
      // A dose that slipped through the prompt is caught here. Section 9 treats
      // dosing as prohibited output, so the suggestion is dropped, not trimmed.
      .filter((s) => {
        const why = violatesForbiddenOutput([s.name, s.reason, s.keywords].filter(Boolean).join(" "));
        if (why) console.warn(`Supplement suggestion suppressed — ${why}:`, s.name);
        return !why;
      })
      .slice(0, 4)
      .map((s) => ({ name: String(s.name), keywords: String(s.keywords), reason: s.reason ? String(s.reason) : "" }));
  } catch (err) {
    console.warn("suggestSupplements failed:", err?.message || err);
    return [];
  }
}
