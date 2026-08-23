/**
 * AI-generated health insight cards.
 *
 * The Home "today" card, the Records cross-panel insight, and the Labs findings
 * used to be deterministic templates (recommendations.js / deterministicInsights.js).
 * This module hands the user's actual snapshot — device vitals, symptoms, labs and
 * lab history, plus their profile — to the AI (via the ghai-ai OpenAI proxy) and
 * asks it to author the same card shapes the screens already render.
 *
 * The deterministic functions remain the fallback: if the AI call fails, returns
 * malformed JSON, or is unavailable, screens fall back to them so the app never
 * shows an empty or broken insight.
 */
import { callAI, firstText } from "./api";
import { buildHealthContext, geneticLine } from "./healthContext";

// Only these navigation targets exist, so the model can't invent a dead link.
const ALLOWED_TARGETS = new Set(["iv", "vitd3", "discussion", "bodyfat_history"]);
const ALLOWED_ICONS = new Set(["alert", "moon", "activity", "sparkles"]);
const ALLOWED_SEVERITY = new Set(["danger", "warn", "info"]);

const SYSTEM = `You are a personal health advocate AI embedded in a health app. You turn a user's OWN device data and lab results into short, specific, plain-language insight cards.

Hard rules:
- Use ONLY the data provided. Never invent values, dates, diagnoses, or facts.
- Cite the actual numbers from the data when you reference them.
- You are an advocate, not a clinician. Never diagnose and never prescribe. Frame next steps as things to bring to a clinician.
- Be warm, concise, and specific. No filler.
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

// `ai: true` on every card is how the UI knows to show the AI (sparkle) icon.
// Deterministic fallback cards never carry this flag, so they show a normal icon.
function sanitizeDaily(d) {
  if (!d || typeof d !== "object" || !d.title || !d.body) return null;
  return {
    ai: true,
    type: "ai_daily",
    priority: Number.isFinite(d.priority) ? d.priority : (d.icon === "alert" ? 100 : 60),
    icon: ALLOWED_ICONS.has(d.icon) ? d.icon : "sparkles",
    title: String(d.title),
    body: String(d.body),
    action: sanitizeAction(d.action),
  };
}

function sanitizeRecord(r) {
  if (!r || typeof r !== "object" || !r.title || !r.body) return null;
  return {
    ai: true,
    type: "ai_record",
    title: String(r.title),
    body: String(r.body),
    doctorPath: r.doctorPath ? String(r.doctorPath) : "",
    selfPayPath: r.selfPayPath ? String(r.selfPayPath) : "",
  };
}

function sanitizeLabs(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => l && l.title && l.body)
    .slice(0, 3)
    .map((l) => ({
      ai: true,
      title: String(l.title),
      body: String(l.body),
      severity: ALLOWED_SEVERITY.has(l.severity) ? l.severity : "warn",
      action: sanitizeAction(l.action),
    }));
}

/**
 * Generate AI insight cards from the user's snapshot.
 * @returns {Promise<{daily, record, labs}|null>} null on any failure (→ deterministic fallback).
 */
export async function generateAIInsights(healthData, profile, healthHistory = null) {
  if (!healthData) return null;

  // The SAME full context the chat and the Discussion Page get — intake answers,
  // labs with ranges and trends, both scores, every wearable metric, genetics,
  // screenings, and the member's own uploaded documents transcribed. The previous
  // hand-built snapshot carried four fields, so the cards were "personalized"
  // insights generated while blind to nearly everything the member had provided.
  const context = buildHealthContext({ userProfile: profile, healthData, healthHistory });

  const user = `Here is everything the app knows about this member:

${context}

Produce insight cards as a JSON object with EXACTLY this shape:
{
  "daily":  { "title": string, "body": string, "icon": "alert"|"moon"|"activity"|"sparkles", "priority": 0-100, "action"?: { "label": string, "target": "iv"|"vitd3"|"discussion"|"bodyfat_history" } } | null,
  "record": { "title": string, "body": string, "doctorPath": string, "selfPayPath": string } | null,
  "labs":   [ { "title": string, "body": string, "severity": "danger"|"warn"|"info", "action"?: { "label": string, "target": "iv"|"vitd3"|"discussion"|"bodyfat_history" } } ]
}

Guidance:
- "daily": the single most important thing about TODAY from device vitals + reported symptoms (e.g. possible illness onset, low recovery/sleep debt, a lab+symptom pattern). Use priority 90-100 only for a same-day health signal like possible illness onset. null if nothing stands out today.
- "record": a cross-panel pattern worth raising with a clinician (e.g. a lab value trending across multiple panels alongside matching symptoms). Include a "Bring to your doctor" path and a self-pay path. null if nothing stands out.
- "labs": 0-3 notable individual lab findings (out-of-range or trending), most important first.
- Only include a card the data actually supports. Every number must come from the data above — labs, wearable readings, uploaded documents, genetics, or screenings. A finding that crosses sources (a lab trend matching a symptom, a genetic variant relevant to a medication, an uploaded report's note echoed by the wearable data) is exactly what these cards are for. Return JSON only.`;

  try {
    const data = await callAI({
      system: SYSTEM,
      messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      maxTokens: 1200,
    });
    const raw = stripFences(firstText(data));
    const parsed = JSON.parse(raw);
    return {
      daily: sanitizeDaily(parsed.daily),
      record: sanitizeRecord(parsed.record),
      labs: sanitizeLabs(parsed.labs),
    };
  } catch (err) {
    console.warn("generateAIInsights failed, falling back to deterministic:", err?.message || err);
    return null;
  }
}

/**
 * Suggest over-the-counter supplements based on the user's own profile (goals,
 * conditions, current meds). Returns [{name, keywords, reason}] — `keywords` is an
 * Amazon search string the caller uses to pull real product cards. OTC supplements
 * only, never prescription drugs. [] on any failure.
 */
export async function suggestSupplements(profile, healthData = null) {
  const p = buildProfileSummary(profile);
  const meds = profile?.medicationsDetail?.length
    ? profile.medicationsDetail.map((m) => [m.name, m.dose, m.frequency, m.type].filter(Boolean).join(" "))
    : profile?.intake?.medications || [];

  // The member's measured data, compacted: suggesting supplements while blind to
  // their labs recommends nothing for a measured deficiency — the one case where a
  // supplement suggestion is actually grounded. Out-of-range markers and genetics
  // (e.g. MTHFR → methylated folate) carry the signal; a full in-range panel is
  // summarized as such so the model doesn't treat "no data" and "all normal" alike.
  const flagged = (healthData?.labs || []).filter((l) => l.status && l.status !== "normal" && l.status !== "unknown");
  const labSummary = flagged.length
    ? flagged.map((l) => `${l.name} ${l.value}${l.unit ? " " + l.unit : ""} (${l.status}${l.range ? ", ref " + l.range : ""}${l.date ? ", " + l.date : ""})`).join("; ")
    : healthData?.labs?.length
      ? "all markers on file within range"
      : "no lab results on file";
  const genetics = (healthData?.genetics || []).map(geneticLine).join("\n");

  const system = `You are a health advocate AI. Suggest a short list of OVER-THE-COUNTER supplements (vitamins, minerals, common OTC supplements) that fit the user's stated goals, profile, and their OWN lab results and genetics below. Rules:
- OTC supplements only. NEVER suggest prescription medications, hormones, peptides, or controlled substances.
- Prefer suggestions grounded in a measured result (an out-of-range lab, a genetic variant) over generic goal-based ones, and say which result in the reason.
- Never suggest something that duplicates a supplement or medication they already take.
- Do not give doses. Do not diagnose. This is not medical advice.
- Output STRICT JSON only.`;
  const user = `User profile: ${JSON.stringify({ ...p, currentMeds: meds })}

Out-of-range / notable lab results: ${labSummary}
${genetics ? `\nGenetics on file:\n${genetics}\n` : ""}
Return JSON: { "suggestions": [ { "name": string, "keywords": string, "reason": string } ] }
- 2 to 4 suggestions, most relevant first.
- "keywords": a concise Amazon search query (e.g. "vitamin d3 k2 supplement").
- "reason": one short sentence tying it to the user's goals/profile.
Return JSON only.`;
  try {
    const data = await callAI({ system, messages: [{ role: "user", content: [{ type: "text", text: user }] }], maxTokens: 500 });
    const parsed = JSON.parse(stripFences(firstText(data)));
    if (!Array.isArray(parsed.suggestions)) return [];
    return parsed.suggestions
      .filter((s) => s && s.name && s.keywords)
      .slice(0, 4)
      .map((s) => ({ name: String(s.name), keywords: String(s.keywords), reason: s.reason ? String(s.reason) : "" }));
  } catch (err) {
    console.warn("suggestSupplements failed:", err?.message || err);
    return [];
  }
}
