// Record reviews (lib/review.mjs): since Oct 21 2026 the insight cards and the visit-prep
// page are written by the team. Every specialist with data reads, the cards go through
// the fact-checker and the code rules, a card that still breaks a rule is dropped, and
// the GLP-1 label card rides in the lanes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { runReview, reviewersFor } = await import('../lib/review.mjs');

const sec = (key, body) => ({ key, title: key.toUpperCase(), body });
const facts = {
  preamble: "TODAY'S DATE: 2026-10-21",
  sections: [
    sec('profile', '- Age: 52\n- Sex at birth / recorded sex: female'),
    sec('labs', '- LDL Cholesterol: 142 mg/dL (drawn 2026-09-17)\n- TSH: 3.1 uIU/mL (drawn 2026-09-17)'),
    sec('medications', ''),
    sec('wearableToday', '- HRV: 38'),
    sec('weight', '- Height: 5 ft 6 in\n- Current weight: 190 lb'),
    sec('preventive', '- Mammogram: not on file'),
  ],
};

test('every specialist with data to read is on the review, and only those', () => {
  assert.deepEqual(reviewersFor(facts), ['bloodwork', 'hormones', 'lifestyle', 'weight', 'general']);
  assert.deepEqual(reviewersFor({ sections: [sec('labs', '- LDL: 99')] }), ['bloodwork']);
  assert.deepEqual(reviewersFor(facts, { firstData: true }), ['general']);
  // Metabolism reads when a metabolic marker or condition is on file.
  assert.ok(reviewersFor({ sections: [sec('labs', '- Hemoglobin A1c: 5.9 % (drawn 2026-09-17)')] }).includes('metabolism'));
  assert.ok(reviewersFor({ sections: [sec('intake', '- Diagnosed conditions: High blood pressure (hypertension)')] }).includes('metabolism'));
});

function stub(composeJson, reviseJson = null) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const user = body.messages.at(-1).content;
    calls.push({ system, user });
    let content;
    if (system.includes('Agent: Safety Review')) content = 'All claims supported.';
    else if (system.includes('writing the insight cards') || system.includes('writing the visit-prep page')) content = user.includes('## Flagged') && reviseJson ? JSON.stringify(reviseJson) : JSON.stringify(composeJson);
    else if (user.includes('conferring with the other specialists')) content = JSON.stringify({ to: 'bloodwork', note: 'Agreed.' });
    else if (system.startsWith('You summarise a care team huddle')) content = 'LDL is the focus.';
    else content = "Read.\n\n## For the member's screen\nHeadline: LDL 142\nFinding: Our member's LDL is 142 mg/dL (Sep 17 2026).\nFlag: watch";
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  };
  return calls;
}

const tall = { unit: 'imperial', feet: '5', inches: '6' };

test('insight cards come back checked, with the GLP-1 card in the lanes', async () => {
  const calls = stub({
    daily: { title: 'Your LDL', body: 'Your LDL of 142 mg/dL (Sep 2026) is worth raising.', basis: 'Lab range under 100 mg/dL. LDL 142, Sep 2026.', icon: 'sparkles', priority: 60 },
    record: null,
    labs: [{ title: 'LDL', body: 'Your LDL is 142 mg/dL.', basis: 'Sep 2026 panel.', severity: 'warn' }],
  });
  const run = { ledger: [], safety: [] };
  const out = await runReview({ task: 'insights', facts, healthData: { sex: 'female', intake: { height: tall, weight: { unit: 'lb', value: '190' } } }, run });
  assert.equal(out.daily.title, 'Your LDL');
  assert.equal(out.labs.length, 1);
  assert.ok(out.lanes.some((c) => c.marker === 'glp1_review'));
  // Every specialist reviewed, and each ran under Dr. Locker's analysis rules.
  const reads = calls.filter((c) => c.user.includes('The Advocate asks you'));
  assert.equal(reads.length, 5);
  assert.ok(reads.every((c) => c.system.includes("Dr. Locker's clinical analysis rules")));
  assert.deepEqual(run.routing.specialists, ['bloodwork', 'hormones', 'lifestyle', 'weight', 'general']);
});

test('a card that still breaks a rule after the revision is dropped, and logged', async () => {
  const bad = { title: 'Iron', body: 'Take 65 mg of iron daily.', basis: 'Sep 2026.', severity: 'warn' };
  stub({ daily: null, record: null, labs: [bad, { title: 'LDL', body: 'Your LDL is 142 mg/dL.', basis: 'Sep 2026.', severity: 'warn' }] },
    { daily: null, record: null, labs: [bad, { title: 'LDL', body: 'Your LDL is 142 mg/dL.', basis: 'Sep 2026.', severity: 'warn' }] });
  const run = { ledger: [], safety: [] };
  const out = await runReview({ task: 'insights', facts, healthData: {}, run });
  assert.deepEqual(out.labs.map((l) => l.title), ['LDL']);
  assert.ok(run.safety.some((e) => e.kind === 'rule_scrub' && /labs\.0 dropped/.test(e.rule)));
});

test('an invented number is revised out or the piece is dropped', async () => {
  stub({ summary: "I'm 52 and my LDL was 142 mg/dL in September 2026.", questions: ['Could we recheck my LDL of 142?', 'Is my ferritin of 417.3 ng/mL a concern?'] },
    { summary: "I'm 52 and my LDL was 142 mg/dL in September 2026.", questions: ['Could we recheck my LDL of 142?'] });
  const out = await runReview({ task: 'discussion', facts, healthData: {}, run: { ledger: [], safety: [] } });
  assert.match(out.summary, /142 mg\/dL/);
  assert.deepEqual(out.questions, ['Could we recheck my LDL of 142?']);
});
