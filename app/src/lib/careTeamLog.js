/**
 * The browser's half of the care-team logs (migration 20261018_care_team_logs.sql):
 *   ghai.safety_events  every reply the safety layer blocked or rewrote, for the
 *                       medical director's weekly review
 *   ghai.agent_runs     which agents answered each question, and which fell back
 *                       to "let's bring this to your clinician"
 *
 * The agents service writes the same rows itself (agents/lib/logs.mjs); these are
 * for the browser fallback and photo replies. Fire-and-forget: a log that fails to
 * write is reported to the console and never touches the member's answer. user_id is
 * left to the column default, auth.uid(), so the row is always the signed-in member's.
 */
import { supabase, isConfigured } from "./supabase";

// The same caps the server uses: enough for the reviewer to see what was blocked,
// short enough that a log row is never a second copy of the thread.
export const EXCERPT_MAX = 500;
const clip = (s, n = EXCERPT_MAX) => {
  const t = String(s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function insert(table, row) {
  if (!isConfigured) return;
  Promise.resolve()
    .then(() => supabase.from(table).insert(row))
    .then(({ error } = {}) => { if (error) console.warn(`${table} log`, error.message || error); })
    .catch((err) => console.warn(`${table} log`, err));
}

/** @param {{kind, rule, excerpt, question, messageId}} e */
export function logSafetyEvent({ kind, rule = null, excerpt = "", question = "", messageId = null }) {
  insert("safety_events", {
    source: "browser",
    kind,
    rule: rule ? clip(rule, 1000) : null,
    excerpt: excerpt ? clip(excerpt) : null,
    question: question ? clip(question) : null,
    message_id: messageId || null,
  });
}

/** @param {{question, specialists, general, fallback, topic, seconds, messageId}} r */
export function logAgentRun({ question = "", specialists = [], general = false, fallback = false, topic = null, seconds = null, messageId = null }) {
  insert("agent_runs", {
    source: "browser",
    path: "team",
    question: clip(question),
    specialists,
    general,
    fallback,
    topic: topic ? clip(topic, 120) : null,
    seconds,
    message_id: messageId || null,
  });
}
