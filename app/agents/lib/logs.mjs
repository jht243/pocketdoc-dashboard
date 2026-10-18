// The two care-team logs (migration 20261018_care_team_logs.sql), written from here:
//
//   ghai.safety_events  every reply the safety layer blocked or rewrote, for the
//                       medical director's weekly review (DESIGN.md step 7)
//   ghai.agent_runs     which agents answered each question, and whether it fell
//                       back to "let's bring this to your clinician"
//
// The service holds no service-role key, so it writes as the member, through
// PostgREST with their own JWT, exactly as the browser would. RLS lets a member
// insert and read their own rows and nothing else; user_id is the column default,
// auth.uid(), so it is never sent and never wrong.
//
// Fire-and-forget: the rows go out after the reply has, and a failed write is a
// console line, never a failed round.
import { env } from './env.mjs';

const EXCERPT_MAX = 500;

const clip = (s, n = EXCERPT_MAX) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

function cfg() {
  return {
    SUPABASE_URL: (env('SUPABASE_URL') || env('VITE_SUPABASE_URL') || '').replace(/\/$/, ''),
    ANON: env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY'),
    // The app binds its client to the same schema (src/lib/supabase.js).
    SCHEMA: env('SUPABASE_SCHEMA') || env('VITE_SUPABASE_SCHEMA') || 'ghai',
  };
}

/** The safety_events rows for one question, from the events the round noted. */
export function safetyRows({ safety = [], question = '', messageId = null }) {
  return safety.map((e) => ({
    source: 'agents',
    kind: e.kind,
    rule: e.rule ? clip(e.rule, 1000) : null,
    excerpt: e.excerpt ? clip(e.excerpt) : null,
    question: clip(question) || null,
    message_id: messageId || null,
  }));
}

/** The agent_runs row for one question, from what the round decided and spent. */
export function runRow({ routing, question = '', messageId = null, seconds = null, ledger = [], usd = null }) {
  return {
    source: 'agents',
    path: routing?.path || 'team',
    question: clip(question) || null,
    specialists: routing?.specialists || [],
    general: Boolean(routing?.general),
    fallback: Boolean(routing?.fallback),
    topic: routing?.topic ? clip(routing.topic, 120) : null,
    seconds,
    cost_usd: usd == null ? null : +Number(usd).toFixed(4),
    model_calls: ledger.length,
    message_id: messageId || null,
  };
}

/**
 * POST rows to a ghai table as the member. Resolves true or false; never rejects.
 * @param {string} auth   the caller's "Bearer <jwt>"
 */
export async function insertRows(table, rows, { auth } = {}) {
  const { SUPABASE_URL, ANON, SCHEMA } = cfg();
  if (!rows?.length || !auth || !SUPABASE_URL || !ANON) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        authorization: auth,
        'content-type': 'application/json',
        // PostgREST serves the ghai schema only when asked for it by name.
        'content-profile': SCHEMA,
        prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      console.log(`[log:${table}] ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`[log:${table}] failed: ${err.message}`);
    return false;
  }
}

/**
 * Write both logs for a finished round. `run.safety` and `run.routing` are filled in
 * by runQuestion as it goes, so a round that failed part-way still logs what its
 * safety layer did; the routing row is written only when an answer went out.
 */
export function writeRoundLogs(run, { question, messageId, answered, seconds, usd }) {
  const jobs = [insertRows('safety_events', safetyRows({ safety: run.safety || [], question, messageId }), run)];
  if (answered && run.routing) jobs.push(insertRows('agent_runs', [runRow({ routing: run.routing, question, messageId, seconds, ledger: run.ledger || [], usd })], run));
  return Promise.all(jobs);
}
