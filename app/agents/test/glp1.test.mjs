// GLP-1 weight-loss medication, Oct 21 2026 (Dr. Locker's call and BMI email):
// eligibility is decided in code from the FDA label, the app never recommends the
// drug, safety exclusions go straight to the clinician, and the Weight specialist is
// the one the team sends weight questions to (Metabolism is its own specialist).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glp1Eligibility, glp1LaneCard, glp1Lines, glp1Inputs, GLP1_FLAG_LINE } from '../../src/lib/glp1.js';
import { violatesForbiddenOutput } from '../../src/lib/clinicalRules.js';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { runQuestion, TEAM } = await import('../lib/team.mjs');

// 5 ft 6 in: 160 lb is BMI 25.8, 175 lb is 28.2, 190 lb is 30.7.
const tall = { unit: 'imperial', feet: '5', inches: '6' };
const at = (lb, extra = {}) => ({ height: tall, weight: { unit: 'lb', value: String(lb) }, ...extra });

test('BMI 30 or higher meets the label alone', () => {
  const r = glp1Eligibility(at(190), 'male');
  assert.equal(r.status, 'candidate');
  assert.match(r.criterion, /BMI 30\.7 \(30 or higher\)/);
});

test('BMI 27 to 29.9 needs a weight-related condition', () => {
  assert.equal(glp1Eligibility(at(175), 'male').status, 'not_candidate');
  for (const c of ['High blood pressure (hypertension)', 'Type 2 Diabetes', 'High cholesterol / dyslipidemia', 'Sleep apnea']) {
    const r = glp1Eligibility(at(175, { conditions: [c] }), 'male');
    assert.equal(r.status, 'candidate', c);
    assert.equal(r.conditions.length, 1);
  }
  // Prediabetes is not on Dr. Locker's list.
  assert.equal(glp1Eligibility(at(175, { conditions: ['Pre-diabetes / insulin resistance'] }), 'male').status, 'not_candidate');
});

test('below 27, or with no height or weight, nothing is flagged', () => {
  assert.equal(glp1Eligibility(at(160, { conditions: ['Type 2 Diabetes'] }), 'female').status, 'not_candidate');
  assert.equal(glp1Eligibility({ weight: { unit: 'lb', value: '250' } }, 'female').status, 'unknown');
  assert.equal(glp1LaneCard(glp1Eligibility(at(160), 'female')), null);
});

test('a safety exclusion sends the member straight to the clinician', () => {
  for (const [extra, sex] of [[{ mtcHistory: 'Yes' }, 'male'], [{ pancreatitisHistory: 'Yes' }, 'male'], [{ tryingToConceive: 'Yes' }, 'female'], [{ pregnancy: 'Pregnant' }, 'female']]) {
    const r = glp1Eligibility(at(190, extra), sex);
    assert.equal(r.status, 'clinician_only', JSON.stringify(extra));
    const card = glp1LaneCard(r);
    assert.equal(card.lane, 'provider');
    assert.match(card.why, /safety exclusion/);
    assert.match(glp1Lines(r), /Never describe them as a candidate/);
  }
  // Trying to conceive is only asked of, and only counts for, female members.
  assert.equal(glp1Eligibility(at(190, { tryingToConceive: 'Yes' }), 'male').status, 'candidate');
});

test('unanswered or "not sure" safety questions are listed for the clinician, never assumed', () => {
  const r = glp1Eligibility(at(190, { mtcHistory: 'Not sure', pancreatitisHistory: 'No' }), 'female');
  assert.equal(r.status, 'candidate');
  assert.deepEqual(r.unanswered, ['personal or family history of medullary thyroid cancer or MEN2', 'pregnant or trying to conceive']);
  assert.match(glp1LaneCard(r).why, /not yet settled/);
});

test('the candidate card is a provider-lane card the follow-ups can open', () => {
  const card = glp1LaneCard(glp1Eligibility(at(190), 'male'));
  assert.equal(card.marker, 'glp1_review');
  assert.equal(card.lane, 'provider');
  assert.equal(card.level, 'flag');
  assert.match(glp1Lines(glp1Eligibility(at(190), 'male')), new RegExp(GLP1_FLAG_LINE.replace(/[.']/g, '.')));
});

test("Dr. Locker's flag line passes the forbidden-output rules", () => {
  assert.equal(violatesForbiddenOutput(GLP1_FLAG_LINE), null);
});

test('only the answers the check needs are sent to the service', () => {
  const sent = glp1Inputs({ ...at(190), conditions: ['Sleep apnea'], primaryConcern: 'private words', mtcHistory: 'No' });
  assert.deepEqual(Object.keys(sent).sort(), ['conditions', 'height', 'mtcHistory', 'weight']);
});

test('weight questions bring in the Weight specialist, and the GLP-1 card rides in the lanes', async () => {
  assert.ok(TEAM.weight && TEAM.weight.facts.includes('weight'));
  assert.ok(TEAM.metabolism && TEAM.metabolism.facts.includes('labs'));
  let composeInput = '';
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const user = body.messages.at(-1).content;
    let content;
    if (system.includes('Agent: My Advocate (the manager)')) content = JSON.stringify({ reason: 'Your question is about weight.', consult: [{ id: 'lifestyle', ask: 'What moves weight for my member?' }] });
    else if (system.includes('Agent: Safety Review')) content = 'All claims supported.';
    else if (system.includes('My Advocate, writing the answer')) { composeInput = user; content = `**${GLP1_FLAG_LINE}**`; }
    else if (user.includes('conferring with the other specialists')) content = JSON.stringify({ to: 'lifestyle', note: 'Agreed.' });
    else if (system.startsWith('You summarise a care team huddle')) content = 'Weight is the focus.';
    else content = "Read.\n\n## For the member's screen\nHeadline: Weight\nFinding: Our member asked about weight.\nFlag: ok";
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  };
  const events = [];
  const facts = { preamble: "TODAY'S DATE: 2026-10-21", sections: [{ key: 'profile', title: 'USER PROFILE', body: '- Age: 52' }] };
  const out = await runQuestion({
    question: 'Should I try Ozempic to lose weight?', facts,
    healthData: { sex: 'female', intake: at(190, { mtcHistory: 'No', pancreatitisHistory: 'No', tryingToConceive: 'No' }) },
    run: { ledger: [] },
  }, (e) => events.push(e));
  const consult = events.find((e) => e.type === 'route_done').consult.map((c) => c.id);
  assert.ok(consult.includes('weight'), consult.join(','));
  assert.ok(!consult.includes('metabolism'), 'a weight question alone does not force Metabolism');
  assert.ok(out.lanes.some((c) => c.marker === 'glp1_review' && c.lane === 'provider'));
  assert.match(composeInput, /Weight-loss medication review/);
});

test("Dr. Locker's line goes in verbatim when the model paraphrases it", async () => {
  const { ensureGlp1Line, glp1ExclusionLine } = await import('../../src/lib/glp1.js');
  const card = glp1LaneCard(glp1Eligibility(at(190), 'male'));
  const paraphrase = '**Your BMI meets the range often considered.**\n\nBring this to your provider\n- Discuss options for weight management.';
  const fixed = ensureGlp1Line(paraphrase, card, 'Am I a candidate for Wegovy?');
  assert.ok(fixed.includes(GLP1_FLAG_LINE));
  assert.ok(fixed.indexOf(GLP1_FLAG_LINE) > fixed.indexOf('Bring this to your provider'));
  // Already there: unchanged. Not about weight: unchanged.
  assert.equal(ensureGlp1Line(fixed, card, 'Am I a candidate?'), fixed);
  assert.equal(ensureGlp1Line('Your vitamin D is 40.', card, 'How is my vitamin D?'), 'Your vitamin D is 40.');
  // An exclusion gets the clinician line, never the candidate line.
  const excluded = glp1LaneCard(glp1Eligibility(at(190, { pancreatitisHistory: 'Yes' }), 'male'));
  const out = ensureGlp1Line('**About weight.**', excluded, 'Can I take Ozempic?');
  assert.ok(out.includes(glp1ExclusionLine(['history of pancreatitis'])));
  assert.ok(!out.includes(GLP1_FLAG_LINE));
});
