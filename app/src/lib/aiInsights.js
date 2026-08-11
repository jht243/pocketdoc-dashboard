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

function sanitizeDaily(d) {
  if (!d || typeof d !== "object" || !d.title || !d.body) return null;
  return {
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
export async function generateAIInsights(healthData, profile) {
  if (!healthData) return null;

  const snapshot = {
    today: healthData.today || null,
    labs: healthData.labs || [],
    labHistory: healthData.labHistory || [],
    profile: buildProfileSummary(profile),
  };

  const user = `Here is the user's current health snapshot as JSON:

${JSON.stringify(snapshot)}

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
- Only include a card the data actually supports. Every number must come from the snapshot. Return JSON only.`;

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
