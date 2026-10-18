// One model call, two ways to reach OpenAI.
//
//  - OPENAI_API_KEY set on this service: straight to OpenAI. The hosted shape.
//  - Not set: through the app's own `ghai-ai` edge function, carrying the member's
//    JWT. The key stays in Supabase's secrets, where it already lives, so the service
//    runs locally and on day one without a second copy of it anywhere.
//
// Every call is written to the run's ledger, so a question's cost is visible rather
// than guessed (the Monitus habit). The ledger is per run, not global: two members
// asking at once must not be billed for each other.
import { env } from './env.mjs';

function cfg() {
  return {
    SMART: env('AGENTS_MODEL', 'gpt-4.1'),
    // Routing, the huddle and mechanical checks: same family, about five times cheaper.
    CHEAP: env('AGENTS_MODEL_CHEAP', 'gpt-4.1-mini'),
    KEY: env('OPENAI_API_KEY'),
    SUPABASE_URL: env('SUPABASE_URL') || env('VITE_SUPABASE_URL'),
    ANON: env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY'),
  };
}

export function providerInfo() {
  const { SMART, CHEAP, KEY } = cfg();
  return { model: SMART, cheap: CHEAP, via: KEY ? 'openai' : 'ghai-ai gateway' };
}

// $ per million tokens, input / output.
const PRICE = { 'gpt-4.1': [2, 8], 'gpt-4.1-mini': [0.4, 1.6], 'gpt-4.1-nano': [0.1, 0.4], 'gpt-4o': [2.5, 10] };
export const costOf = (rows) => rows.reduce((a, r) => {
  const [pi, po] = PRICE[r.model] || [2, 8];
  return a + (r.in * pi + r.out * po) / 1e6;
}, 0);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, headers, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    // A 429 is "come back in a moment". The gateway retries its own; this covers the direct path.
    if (res.status === 429 && attempt < 3) { await sleep(Math.min(1000 * 2 ** attempt, 8000)); continue; }
    if (!res.ok) throw new Error(data?.error?.message || data?.error || `model call failed (${res.status})`);
    return data;
  }
}

/**
 * @param {object} o
 * @param {string} o.system
 * @param {string} [o.user]          a single user turn, or
 * @param {Array}  [o.messages]      a thread of {role, content} (string content only)
 * @param {'smart'|'cheap'} [o.tier]
 * @param {object} o.run             { auth, ledger } — the caller's JWT and this question's ledger
 * @returns {Promise<string>} the assistant text
 */
export async function complete({ system, user, messages, maxTokens = 1200, temperature = 0.2, label = 'call', tier = 'smart', run }) {
  const { SMART, CHEAP, KEY, SUPABASE_URL, ANON } = cfg();
  const model = tier === 'cheap' ? CHEAP : SMART;
  const thread = [{ role: 'system', content: system }, ...(messages || [{ role: 'user', content: user }])];

  let data;
  if (KEY) {
    data = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${KEY}` },
      { model, temperature, max_tokens: maxTokens, messages: thread });
  } else {
    if (!SUPABASE_URL || !ANON || !run?.auth) throw new Error('No OPENAI_API_KEY and no gateway credentials for this call.');
    // The gateway takes model, messages and max_tokens only; temperature is its default.
    data = await post(`${SUPABASE_URL}/functions/v1/ghai-ai`, { authorization: run.auth, apikey: ANON },
      { model, messages: thread, max_tokens: maxTokens });
  }
  run?.ledger?.push({ label, model, in: data?.usage?.prompt_tokens ?? 0, out: data?.usage?.completion_tokens ?? 0 });
  return String(data?.choices?.[0]?.message?.content ?? '').trim();
}

/** Pull the first JSON object out of a reply that may wrap it in prose or fences. */
export function parseJson(text) {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}
