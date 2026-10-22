// The Biological Age specialist (Oct 21 2026) and Dr. Locker's rule for "how do I get
// younger": every bio-age question reaches the specialist, a "bring it down" question
// also brings in Weight, Metabolism and Hormone & Thyroid, and the brief carries the
// plan (all nine markers, weight and hormones in honestly, years only from the simulator).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { route, TEAM } = await import('../lib/team.mjs');
const { reviewersFor } = await import('../lib/review.mjs');
const { systemFor } = await import('../lib/config.mjs');

function stubRouter(consult) {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content: JSON.stringify({ reason: 'r', consult }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
  };
}
const facts = { preamble: '', sections: [] };
const ids = async (question, consult = []) => { stubRouter(consult); return (await route({ question, recent: [], facts, run: { ledger: [] } })).consult.map((c) => c.id); };

test('the specialist is on the roster with the bio-age library and the record it needs', () => {
  assert.ok(TEAM.bioage.library.includes('bio-age'));
  for (const k of ['bioAge', 'labs', 'weight']) assert.ok(TEAM.bioage.facts.includes(k), k);
  assert.ok(!/biological/.test(TEAM.bloodwork.desc), 'bio age moved off Blood Work');
});

test('any biological-age question brings the specialist in', async () => {
  for (const q of ['What is my biological age?', 'Why is my bio age higher than my real age?', 'How is my heart age worked out?']) {
    assert.ok((await ids(q)).includes('bioage'), q);
  }
});

test('"bring it down" brings in Weight, Metabolism and Hormone & Thyroid too (Dr. Locker, Oct 21)', async () => {
  for (const q of ['Help me reduce my biological age.', 'How do I bring my biological age down?', 'How can I get younger?', 'What would lower my bio age?']) {
    const got = await ids(q);
    for (const id of ['bioage', 'weight', 'metabolism', 'hormones']) assert.ok(got.includes(id), `${q} → ${got.join(',')}`);
  }
  // Explaining the number is not asking to change it.
  assert.ok(!(await ids('What is my biological age?')).includes('weight'));
});

test('the brief carries the get-younger rule and the year limit', () => {
  const brief = readFileSync(new URL('../briefs/bioage/brief.md', import.meta.url), 'utf8');
  assert.match(brief, /Read all nine markers, not just the simulator's two/);
  assert.match(brief, /Bring in weight and hormones, honestly/);
  assert.match(brief, /Years only from the simulator/);
  // And it runs under the shared rules and Dr. Locker's analysis rules.
  const system = systemFor('bioage');
  assert.match(system, /Dr\. Locker's clinical analysis rules/);
  assert.match(system, /No biological-age years/);
});

test('record reviews include the specialist only when a biological age was calculated', () => {
  const sec = (key, body) => ({ key, title: key, body });
  assert.ok(reviewersFor({ sections: [sec('labs', '- Albumin: 4.4 g/dL'), sec('bioAge', '- Biological age 50 against chronological age 53, from the Jun 1 2026 draw')] }).includes('bioage'));
  assert.ok(!reviewersFor({ sections: [sec('labs', '- Albumin: 4.4 g/dL'), sec('bioAge', '- Not calculated: add a CBC with differential.')] }).includes('bioage'));
});

test('a router pick cut by the cap can still be added by the bio-age plan', async () => {
  const got = await ids('Help me reduce my biological age.', [{ id: 'bloodwork', ask: 'a' }, { id: 'bioage', ask: 'b' }, { id: 'weight', ask: 'c' }, { id: 'hormones', ask: 'd' }]);
  for (const id of ['bioage', 'weight', 'metabolism', 'hormones']) assert.ok(got.includes(id), got.join(','));
});
