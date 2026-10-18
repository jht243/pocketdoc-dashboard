// The agents service: My Advocate and the four specialist advocates behind the chat.
//
//   POST /chat    { question, history, facts, healthData }  → text/event-stream
//   GET  /health  → { ok, model, cheap, via }
//
// WHY A SERVER. One question is about a dozen model calls (route, four reads in
// parallel, huddle, compose, fact-check, revise), which used to run in the member's
// browser behind the app's one-at-a-time AI queue. A Node process on Render is the
// shape Monitus settled on for the same pipeline.
//
// WHO MAY ASK. The caller sends their Supabase JWT, checked against Supabase Auth on
// every request. The record arrives in the body, assembled by the member's own app
// from data RLS already let them read, and the answer goes back only to them.
// Reading the record here, through the caller's client, is the later step (as in
// Monitus facts-db.mjs); the agents won't notice the difference.
//
// THE MODEL KEY. With OPENAI_API_KEY set here, calls go straight to OpenAI.
// Without it they go through the app's ghai-ai edge function with the member's JWT,
// so the key never leaves Supabase (lib/llm.mjs).
import http from 'node:http';
import { env } from './lib/env.mjs';
import { providerInfo, costOf } from './lib/llm.mjs';
import { runQuestion } from './lib/team.mjs';

const PORT = process.env.PORT || env('AGENTS_PORT', 5190);
const SUPABASE_URL = env('SUPABASE_URL') || env('VITE_SUPABASE_URL');
const ANON = env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
const ORIGINS = (env('ALLOWED_ORIGINS', '*') || '*').split(',').map((s) => s.trim()).filter(Boolean);
const MAX_BODY = 4e6; // the record carries transcribed documents (capped at 20k chars in healthContext)

function cors(req, res) {
  const origin = req.headers.origin || '';
  const allow = ORIGINS.includes('*') ? '*' : ORIGINS.includes(origin) ? origin : ORIGINS[0];
  res.setHeader('access-control-allow-origin', allow);
  res.setHeader('access-control-allow-headers', 'authorization, content-type');
  res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
  res.setHeader('vary', 'origin');
}

const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };

const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  req.on('error', reject);
});

/** The signed-in member behind this request, or null. */
async function caller(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || !SUPABASE_URL || !ANON) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey: ANON } }).catch(() => null);
  if (!res?.ok) return null;
  const user = await res.json().catch(() => null);
  return user?.id ? { auth, user } : null;
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, `http://localhost:${PORT}`);

  if (u.pathname === '/health') return json(res, 200, { ok: true, ...providerInfo(), auth: Boolean(SUPABASE_URL && ANON) });

  if (u.pathname === '/chat' && req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch { return json(res, 400, { error: 'Body must be JSON, under 4 MB.' }); }
    const who = await caller(req);
    if (!who) return json(res, 401, { error: 'Not signed in.' });
    const question = String(body.question ?? '').trim();
    if (!question) return json(res, 400, { error: 'Ask something.' });
    if (!Array.isArray(body.facts?.sections)) return json(res, 400, { error: 'The record (facts.sections) is missing.' });

    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    // AGENTS_LOG_EVENTS=1 prints every event with its time, to check the card against the real calls.
    const logEvents = env('AGENTS_LOG_EVENTS') === '1';
    const send = (o) => {
      if (logEvents && o.t != null) console.log(`  ${String(o.t).padStart(6)}ms  ${o.type}${o.id ? ` ${o.id}` : o.from ? ` ${o.from}→${o.to}` : ''}`);
      res.write(`data: ${JSON.stringify(o)}\n\n`);
    };
    // A comment line every 15s keeps proxies from closing a quiet stream mid-round.
    const beat = setInterval(() => res.write(': keep-alive\n\n'), 15000);
    const run = { auth: who.auth, ledger: [] };
    try {
      const { reply, sources, lanes } = await runQuestion({
        question,
        history: Array.isArray(body.history) ? body.history : [],
        facts: body.facts,
        healthData: body.healthData || {},
        run,
      }, send);
      send({ type: 'reply', text: reply, sources, lanes });
      const usd = costOf(run.ledger);
      send({ type: 'cost', calls: run.ledger.length, tokensIn: run.ledger.reduce((a, r) => a + r.in, 0), tokensOut: run.ledger.reduce((a, r) => a + r.out, 0), usd: +usd.toFixed(4) });
      console.log(`[$${usd.toFixed(3)}] ${who.user.id.slice(0, 8)} ${run.ledger.length} calls: ${question.slice(0, 80)}`);
    } catch (e) {
      console.error(e);
      send({ type: 'error', message: String(e.message || e) });
    } finally {
      clearInterval(beat);
      send({ type: 'done' });
      res.end();
    }
    return;
  }

  res.writeHead(404); res.end('not found');
});

server.listen(PORT, () => {
  const { model, cheap, via } = providerInfo();
  console.log(`Thumbprint agents on :${PORT}  (${model} / ${cheap} via ${via})  auth=${Boolean(SUPABASE_URL && ANON)}`);
});
