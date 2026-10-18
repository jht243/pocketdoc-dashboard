/**
 * The chat's door to the agents service (app/agents): My Advocate and the four
 * specialists, run on the server instead of in the browser.
 *
 * Switched on by VITE_AGENTS_URL. Unset, the chat keeps running the browser care
 * team (careTeam.js runCareTeam), which is also the fallback when the service is
 * unreachable, so turning this on can never leave a member without an answer.
 *
 * The service streams the same events the browser team emits, so the care-team
 * card animates either one the same way.
 */
import { supabase } from "./supabase";
import { buildFactSections } from "./healthContext";

export const AGENTS_URL = (import.meta.env.VITE_AGENTS_URL || "").replace(/\/$/, "");
export const agentsEnabled = () => Boolean(AGENTS_URL);

// The slowest real round is about a minute; past three, the connection is dead.
const ROUND_TIMEOUT_MS = 180000;

/**
 * @param {object}   opts
 * @param {string}   opts.question
 * @param {Array}    opts.history      prior turns as {role, content}, text only
 * @param {object}   opts.userProfile
 * @param {object}   opts.healthData
 * @param {object}  [opts.healthHistory]
 * @param {boolean} [opts.testModeEnabled]
 * @param {Function} opts.onEvent       each care-team event as it arrives
 * @returns {Promise<{reply, citations, sources, events, cost}>}
 */
export async function runAgentTeam({ question, history, userProfile, healthData, healthHistory, testModeEnabled, onEvent }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");

  // The record, assembled here from what RLS already let this member read, in keyed
  // sections so each specialist is handed only its own slice.
  const facts = buildFactSections({ userProfile, healthData, healthHistory, testModeEnabled });
  // The code safety checks and the routing lanes read structured values, not text.
  // Sex picks the sex-specific thresholds (ferritin, HDL, creatinine).
  const slim = { labs: healthData?.labs || [], sex: userProfile?.profile?.sex || null, score: { bloodwork: { markers: healthData?.score?.bloodwork?.markers || [] } } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUND_TIMEOUT_MS);
  const events = [];
  let reply = null;
  let sources = [];
  let cost = null;
  try {
    const res = await fetch(`${AGENTS_URL}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ question, history, facts, healthData: slim }),
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
        if (e.type === "reply") { reply = e.text; sources = e.sources || []; continue; }
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
  return { reply, citations: [], sources, events, cost };
}
