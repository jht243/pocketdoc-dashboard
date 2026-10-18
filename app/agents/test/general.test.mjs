// The General agent and the two logs, with the model stubbed: an off-topic question
// routes to General and comes back as "let's bring this to your clinician", that
// fallback is what the routing log counts, an in-scope one is not a fallback, and
// every block or rewrite by the safety layer is noted for the medical director.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key-not-real';
process.env.SUPABASE_URL = 'https://project.supabase.test';
process.env.SUPABASE_ANON_KEY = 'anon-key-not-real';
const { runQuestion, routingOf, ensureClinicianLine, TEAM } = await import('../lib/team.mjs');
const { safetyRows, runRow, insertRows, writeRoundLogs } = await import('../lib/logs.mjs');

const facts = {
  preamble: "TODAY'S DATE: 2026-10-18",
  sections: [
    { key: 'profile', title: 'USER PROFILE', body: '- Age: 53\n- Sex at birth / recorded sex: male' },
    { key: 'medications', title: 'MEDICATIONS & SUPPLEMENTS', body: '- Vitamin D3' },
    { key: 'labs', title: 'LAB RESULTS', body: '- Vitamin D, 25-OH: 74 ng/mL (drawn 2026-09-17)' },
    { key: 'preventive', title: 'PREVENTIVE CARE SCHEDULE', body: '- Colonoscopy: last done 2019' },
  ],
};

const screen = (headline, extra = '') => `Read for the Advocate.\n\n## For the member's screen\nHeadline: ${headline}\nFinding: Our member's record has what bears on this.\nFlag: ok${extra}`;

/**
 * A stand-in for OpenAI that answers by which agent is calling.
 * @param {object} o
 * @param {object} o.plan      what the Advocate's router returns
 * @param {string} o.general   General's research reply
 * @param {string} o.compose   the Advocate's composed answer
 * @param {string} [o.check]   the fact-checker's verdict
 */
function stubModel({ plan, general = screen('For the clinician', '\nScope: out\nTopic: skin rash'), compose, check = 'All claims supported.' }) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const user = body.messages.at(-1).content;
    calls.push({ system, user });
    let content;
    if (system.includes('Agent: My Advocate (the manager)')) content = JSON.stringify(plan);
    else if (system.includes('Agent: Safety Review')) content = check;
    else if (system.includes('My Advocate, writing the answer')) content = compose;
    else if (system.includes('Agent: General')) content = general;
    else if (user.includes('conferring with the other specialists')) content = JSON.stringify({ to: 'general', note: 'Agreed.' });
    else if (system.startsWith('You summarise a care team huddle')) content = 'The team agrees.';
    else content = screen('Vitamin D is 74');
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }), { status: 200 });
  };
  return calls;
}

test('General is on the roster, scope-limited, reading the preventive schedule', () => {
  assert.ok(TEAM.general);
  assert.equal(TEAM.general.scoped, true);
  assert.deepEqual(TEAM.general.library, ['preventive']);
  assert.ok(TEAM.general.facts.includes('preventive'));
});

test('an off-topic question routes to General and falls back to the clinician', async () => {
  const calls = stubModel({
    plan: { reason: 'A rash needs someone to look at it.', consult: [{ id: 'general', ask: "What should my member raise about a new rash?" }] },
    // Compose forgets the words; code puts them back.
    compose: '## Bring this to your provider\n- **When it started** and whether it spreads.',
  });
  const events = [];
  const run = { ledger: [], safety: [] };
  const out = await runQuestion({ question: 'I have a red rash on my arm, what could it be?', facts, healthData: {}, run }, (e) => events.push(e));

  // The router's prompt offers General, and the brief tells it where off-topic goes.
  const routeCall = calls.find((c) => c.system.includes('Agent: My Advocate (the manager)'));
  assert.match(routeCall.user, /"general":/);
  assert.match(routeCall.system, /→ general, alone/);
  // General alone: nothing forced in, so no huddle.
  assert.deepEqual(events.find((e) => e.type === 'route_done').consult.map((c) => c.id), ['general']);
  assert.ok(!events.some((e) => e.type === 'huddle_start'));
  // General was asked for its scope; compose was told it is out of scope.
  assert.match(calls.find((c) => c.system.includes('Agent: General')).user, /Scope: <in \| out>/);
  assert.match(calls.find((c) => c.system.includes('My Advocate, writing the answer')).user, /## Out of scope/);

  assert.match(out.reply, /^\*\*Let's bring this to your clinician\.\*\*/);
  assert.deepEqual(out.routing, { path: 'team', specialists: ['general'], general: true, fallback: true, topic: 'skin rash' });
  assert.deepEqual(run.routing, out.routing);
});

test('a question on the approved list is answered and is not a fallback', async () => {
  const calls = stubModel({
    plan: { reason: 'Your screening schedule.', consult: [{ id: 'general', ask: 'Which screenings is my member due for?' }] },
    general: screen('Colonoscopy is due', '\nScope: in\nTopic: colon cancer screening'),
    compose: '**Your last colonoscopy on file was in 2019.**',
  });
  const run = { ledger: [] };
  const out = await runQuestion({ question: 'Which screenings am I due for?', facts, healthData: {}, run }, () => {});
  assert.equal(out.routing.general, true);
  assert.equal(out.routing.fallback, false);
  assert.doesNotMatch(out.reply, /clinician/);
  assert.doesNotMatch(calls.find((c) => c.system.includes('My Advocate, writing the answer')).user, /## Out of scope/);
});

test('General without a Scope line still counts as a fallback when it handed off', () => {
  assert.equal(routingOf([{ id: 'general' }], { scope: null, read: "Let's bring this to your clinician: it needs an exam." }).fallback, true);
  assert.equal(routingOf([{ id: 'general' }], { scope: null, read: 'Your colonoscopy is due.' }).fallback, false);
  // General asked but never reported: no fallback claimed.
  assert.equal(routingOf([{ id: 'general' }], null).fallback, false);
  // No General, no fallback, whatever anyone said.
  assert.deepEqual(routingOf([{ id: 'bloodwork' }], null), { path: 'team', specialists: ['bloodwork'], general: false, fallback: false, topic: null });
  // The clinician line is added once, never twice.
  assert.equal(ensureClinicianLine("Let's bring this to your clinician. Raise X."), "Let's bring this to your clinician. Raise X.");
});

test('a part-clinical question brings General in beside the specialist', async () => {
  stubModel({
    plan: { reason: 'r', consult: [{ id: 'bloodwork', ask: 'Vitamin D?' }, { id: 'general', ask: 'The rash?' }] },
    compose: "**Your vitamin D is 74 ng/mL (Sep 2026). Let's bring this to your clinician for the rash.**",
  });
  const out = await runQuestion({ question: 'Is my vitamin D ok, and why do I have a rash?', facts, healthData: {}, run: { ledger: [] } }, () => {});
  assert.deepEqual(out.routing.specialists, ['bloodwork', 'general']);
  assert.equal(out.routing.fallback, true);
  // The words were there already, so nothing is prepended.
  assert.match(out.reply, /^\*\*Your vitamin D/);
});

/* ---------------- the safety log ---------------- */

test('a dose rewritten by the rules is noted with the words that were blocked', async () => {
  stubModel({
    plan: { reason: 'r', consult: [{ id: 'bloodwork', ask: 'Vitamin D?' }] },
    compose: 'Your level is 74 ng/mL. Take 5000 IU of vitamin D3 daily with food.',
  });
  const run = { ledger: [], safety: [] };
  await runQuestion({ question: 'How much vitamin D should I take?', facts, healthData: {}, run }, () => {});
  const ev = run.safety.find((e) => e.kind === 'rule_rewrite' || e.kind === 'rule_scrub');
  assert.ok(ev, JSON.stringify(run.safety));
  assert.match(ev.excerpt, /5000 IU/);
  assert.doesNotMatch(ev.excerpt, /74 ng\/mL/, 'only the offending sentence, not the whole reply');
  assert.ok(ev.rule);
});

test('a fact-check flag is noted with the quoted words', async () => {
  stubModel({
    plan: { reason: 'r', consult: [{ id: 'bloodwork', ask: 'Vitamin D?' }] },
    compose: 'Your vitamin D is 90 ng/mL.',
    check: 'NUMBER: "vitamin D is 90 ng/mL" not in the record',
  });
  const run = { ledger: [], safety: [] };
  await runQuestion({ question: 'Is my vitamin D ok?', facts, healthData: {}, run }, () => {});
  const ev = run.safety.find((e) => e.kind === 'fact_check');
  assert.equal(ev.excerpt, 'vitamin D is 90 ng/mL');
  assert.match(ev.rule, /^NUMBER:/);
});

test('crisis and Section 9 bypasses are noted, with no agents run', async () => {
  const calls = stubModel({ plan: {}, compose: '' });
  const run = { ledger: [], safety: [] };
  await runQuestion({ question: 'I want to kill myself', facts, healthData: {}, run }, () => {});
  assert.equal(calls.length, 0);
  assert.equal(run.safety[0].kind, 'crisis');
  assert.equal(run.routing.path, 'crisis');

  const today = new Date().toISOString().slice(0, 10);
  const run2 = { ledger: [], safety: [] };
  await runQuestion({ question: 'How are my labs?', facts, healthData: { labs: [{ name: 'Fasting glucose', value: 450, unit: 'mg/dL', drawnOn: today, date: today }] }, run: run2 }, () => {});
  assert.equal(run2.safety[0].kind, 'emergency');
  assert.match(run2.safety[0].excerpt, /450/);
  assert.equal(run2.routing.path, 'emergency');
});

/* ---------------- writing the logs ---------------- */

test('log rows carry the source, caps and the counts the review needs', () => {
  const long = 'x'.repeat(2000);
  const [row] = safetyRows({ safety: [{ kind: 'rule_scrub', rule: 'dose', excerpt: long }], question: long, messageId: 'm1' });
  assert.equal(row.source, 'agents');
  assert.equal(row.kind, 'rule_scrub');
  assert.ok(row.excerpt.length <= 500 && row.question.length <= 500);
  assert.equal(row.message_id, 'm1');
  assert.ok(!('user_id' in row), 'user_id is the column default, auth.uid()');

  const r = runRow({ routing: { path: 'team', specialists: ['general'], general: true, fallback: true, topic: 'skin rash' }, question: 'q', seconds: 12, ledger: [{}, {}, {}], usd: 0.01234 });
  assert.deepEqual(
    { specialists: r.specialists, general: r.general, fallback: r.fallback, topic: r.topic, model_calls: r.model_calls, cost_usd: r.cost_usd, seconds: r.seconds },
    { specialists: ['general'], general: true, fallback: true, topic: 'skin rash', model_calls: 3, cost_usd: 0.0123, seconds: 12 },
  );
});

test('logs go to PostgREST as the member, in the ghai schema, and never throw', async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url, init }); return new Response('', { status: 201 }); };
  const run = { auth: 'Bearer member-jwt', ledger: [{}], safety: [{ kind: 'crisis', rule: 'r', excerpt: 'e' }], routing: { path: 'crisis', specialists: [] } };
  await writeRoundLogs(run, { question: 'q', messageId: null, answered: true, seconds: 0, usd: 0 });
  assert.deepEqual(sent.map((s) => s.url).sort(), ['https://project.supabase.test/rest/v1/agent_runs', 'https://project.supabase.test/rest/v1/safety_events']);
  for (const { init } of sent) {
    assert.equal(init.headers.authorization, 'Bearer member-jwt');
    assert.equal(init.headers.apikey, 'anon-key-not-real');
    assert.equal(init.headers['content-profile'], 'ghai');
  }

  // A round that failed before answering logs its safety events, not a routing row.
  sent.length = 0;
  await writeRoundLogs({ ...run }, { question: 'q', answered: false });
  assert.deepEqual(sent.map((s) => s.url), ['https://project.supabase.test/rest/v1/safety_events']);

  // No JWT, nothing sent. A dead network resolves false instead of throwing.
  sent.length = 0;
  assert.equal(await insertRows('safety_events', [{ kind: 'crisis' }], {}), false);
  assert.equal(sent.length, 0);
  globalThis.fetch = async () => { throw new Error('offline'); };
  assert.equal(await insertRows('safety_events', [{ kind: 'crisis' }], { auth: 'Bearer x' }), false);
});
