/**
 * The app's door to the agents service (app/agents): My Advocate and the specialists.
 * Since Oct 21 2026 every recommendation the app shows comes from here: chat answers
 * (photos included), the insight cards and the visit-prep page (`runAgentReview`), and
 * the onboarding welcome. There is no browser fallback: when the service can't answer,
 * the screen says so and offers a retry rather than showing advice written any other way.
 *
 * The service streams the same events the browser team emits, so the care-team
 * card animates either one the same way.
 *
 * The reply event also carries the routing lanes (agents/lib/escalation.mjs). They
 * are returned to the chat, which opens a provider follow-up for each marker in
 * "Bring this to your provider" (followUpStore.js).
 */
import { supabase } from "./supabase";
import { buildFactSections } from "./healthContext";
import { glp1Inputs } from "./glp1";

export const AGENTS_URL = (import.meta.env.VITE_AGENTS_URL || "").replace(/\/$/, "");
export const agentsEnabled = () => Boolean(AGENTS_URL);

/**
 * The structured values the service's code checks read (the record itself goes as
 * text): labs for the lanes and urgency, sex for the sex-specific thresholds, the
 * bloodwork markers for the "normal" rule, and the intake answers the GLP-1 label
 * check reads (glp1.js), so eligibility is decided in code from the member's answers.
 */
function slimHealthData({ userProfile, healthData, healthHistory }) {
  return {
    labs: healthData?.labs || [], sex: userProfile?.profile?.sex || null,
    score: { bloodwork: { markers: healthData?.score?.bloodwork?.markers || [] } },
    intake: glp1Inputs({ ...(userProfile?.intake || {}), ...(healthHistory || {}) }),
  };
}

// A review is the whole team reading the whole record: about as long as a chat round.
const REVIEW_TIMEOUT_MS = 240000;

/**
 * The team reads the member's whole record and writes a screen (agents/lib/review.mjs):
 * "insights" → { daily, record, labs, lanes }, "discussion" → { summary, questions, lanes }.
 * Throws when the service can't answer; the caller shows nothing rather than a guess.
 *
 * @param {object} o
 * @param {"insights"|"discussion"} o.task
 * @param {object} [o.extras]  computed in the app: targets, conversation, breadth, freshness, urgent, recheck, firstData
 */
export async function runAgentReview({ task, userProfile, healthData, healthHistory, extras = {} }) {
  if (!agentsEnabled()) throw new Error("Your care team isn't available right now.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");
  const facts = buildFactSections({ userProfile, healthData, healthHistory });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(`${AGENTS_URL}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ task, facts, healthData: slimHealthData({ userProfile, healthData, healthHistory }), extras }),
      signal: controller.signal,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `Agents service answered ${res.status}`);
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// The slowest real round is about a minute; past three, the connection is dead.
const ROUND_TIMEOUT_MS = 180000;

// A scan read twice and settled can take a couple of minutes on a long report.
const INGEST_TIMEOUT_MS = 300000;

/**
 * Read an uploaded document into the record on the service (agents/lib/ingest.mjs):
 * the Blood Work or Genetics specialist reads it with the document tools, the Fact
 * Checker reads it independently, and only what both reads support comes back.
 *
 * @param {object} o
 * @param {"labs"|"genetic"} o.kind
 * @param {string}  o.file       base64, no data-URL prefix
 * @param {string} [o.mediaType]
 * @param {boolean} [o.extract]  false: the checked transcription only
 * @returns {Promise<{ text, unclear, dropped, markers, genetics, drawnOn, source, empty, readBy, checkedBy }>}
 */
export async function readDocument({ kind = "labs", file, mediaType = "", extract = true }) {
  if (!agentsEnabled()) throw new Error("Your care team isn't available to read this right now.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INGEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${AGENTS_URL}/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ kind, file, mediaType, extract }),
      signal: controller.signal,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `The reading service answered ${res.status}`);
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object}   opts
 * @param {string}   opts.question
 * @param {Array}    opts.history      prior turns as {role, content}, text only
 * @param {object}   opts.userProfile
 * @param {object}   opts.healthData
 * @param {object}  [opts.healthHistory]
 * @param {Function} opts.onEvent       each care-team event as it arrives
 * @param {string}  [opts.messageId]    the stored question, so the service's logs can point at it
 * @returns {Promise<{reply, citations, sources, lanes, events, cost}>}
 */
export async function runAgentTeam({ question, history, userProfile, healthData, healthHistory, onEvent, messageId = null, image = null }) {
  if (!agentsEnabled()) throw new Error("Your care team isn't available right now.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");

  // The record, assembled here from what RLS already let this member read, in keyed
  // sections so each specialist is handed only its own slice.
  const facts = buildFactSections({ userProfile, healthData, healthHistory });
  // The code safety checks and the routing lanes read structured values, not text.
  // Sex picks the sex-specific thresholds (ferritin, HDL, creatinine).
  const slim = slimHealthData({ userProfile, healthData, healthHistory });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUND_TIMEOUT_MS);
  const events = [];
  let reply = null;
  let sources = [];
  let lanes = [];
  let cost = null;
  try {
    const res = await fetch(`${AGENTS_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ question, history, facts, healthData: slim, messageId, image }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Agents service answered ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue; // keep-alive comment
        const e = JSON.parse(line.slice(6));
        if (e.type === "error") throw new Error(e.message);
        if (e.type === "reply") { reply = e.text; sources = e.sources || []; lanes = e.lanes || []; continue; }
        if (e.type === "cost") { cost = e; continue; }
        if (e.type === "done") continue;
        events.push(e);
        onEvent?.(e);
      }
    }
  } finally {
    clearTimeout(timer);
  }
  if (reply == null) throw new Error("The care team stopped before answering.");
  // The service reads no web pages (the Oct 14 spec: curated sources, no open search
  // at answer time), so there are no link citations. Its sources are the member's
  // record and the library, returned in `sources`.
  return { reply, citations: [], sources, lanes, events, cost };
}
