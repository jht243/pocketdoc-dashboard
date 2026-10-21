// The pipeline end to end with the model stubbed: event order, the CareTeam.jsx
// event contract, routing that forces the right specialist, the newest-reading
// record slice, and the code safety net catching a dose the model let through.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { runQuestion, factsFor, TEAM } = await import('../lib/team.mjs');

const facts = {
  preamble: "TODAY'S DATE: 2026-10-18",
  sections: [
    { key: 'profile', title: 'USER PROFILE', body: '- Age: 53\n- Sex at birth / recorded sex: male' },
    { key: 'medications', title: 'MEDICATIONS & SUPPLEMENTS', body: '- Vitamin D3' },
    { key: 'labs', title: 'LAB RESULTS', body: '- Vitamin D, 25-OH: 74 ng/mL (drawn 2026-09-17)' },
    { key: 'wearableToday', title: 'WEARABLE — LATEST DAY', body: '- HRV: 42' },
  ],
};

// A stand-in for OpenAI that answers by which agent is calling.
function stubModel({ composeText, delay = {} }) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const ms = Object.entries(delay).find(([k]) => JSON.parse(init.body).messages[0].content.includes(k))?.[1];
    if (ms) await new Promise((r) => setTimeout(r, ms));
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const user = body.messages.at(-1).content;
    calls.push({ system, user });
    let content;
    if (system.includes('Agent: My Advocate (the manager)')) {
      content = JSON.stringify({ reason: 'Your vitamin D touches labs and supplements.', consult: [{ id: 'bloodwork', ask: "Is my member's vitamin D current?" }] });
    } else if (system.includes('Agent: Safety Review')) {
      content = 'All claims supported.';
    } else if (system.includes('My Advocate, writing the answer')) {
      content = composeText;
    } else if (user.includes('conferring with the other specialists')) {
      const to = user.includes('### bloodwork') ? 'bloodwork' : 'medications';
      content = JSON.stringify({ to, note: 'Agreed, our member is on D3 and the newest level is 74.' });
    } else if (system.startsWith('You summarise a care team huddle')) {
      content = 'Your newest vitamin D is in a good place.';
    } else {
      content = `Read for the Advocate.\n\n## For the member's screen\nHeadline: Vitamin D is 74, not low\nFinding: Our member's newest vitamin D is 74 ng/mL (Sep 17 2026).\nFlag: ok`;
    }
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 20 } }), { status: 200 });
  };
  return calls;
}

test('a round emits the CareTeam.jsx event contract in order', async () => {
  const calls = stubModel({ composeText: 'Your newest vitamin D is **74 ng/mL** (Sep 17 2026).' });
  const events = [];
  const run = { auth: null, ledger: [] };
  const { reply } = await runQuestion({ question: 'Is my vitamin D low? Should I keep my supplement?', facts, healthData: {}, run }, (e) => events.push(e));

  const types = events.map((e) => e.type);
  assert.deepEqual(types.slice(0, 2), ['route_start', 'route_done']);
  // The router picked bloodwork; "supplement" forces the medication specialist in too.
  assert.deepEqual(events[1].consult.map((c) => c.id), ['bloodwork', 'medications']);
  // Both specialists are called at once, and each reports when it is actually done.
  assert.deepEqual(types.slice(2, 6), ['specialist_start', 'specialist_start', 'specialist_done', 'specialist_done']);
  assert.equal(events[4].headline, 'Vitamin D is 74, not low');
  assert.equal(events[1].parallel, true);
  assert.ok(types.includes('huddle_note'));
  assert.deepEqual(types.slice(-6), ['huddle_done', 'draft_start', 'draft_done', 'safety_start', 'safety_done', 'answer']);
  assert.ok(events.every((e) => typeof e.t === 'number'));
  assert.match(reply, /74 ng\/mL/);
  assert.ok(run.ledger.length >= 6, `ledger has ${run.ledger.length} calls`);

  // Each specialist sees only its slice of the record: Medication does not get the wearable.
  const medRead = calls.find((c) => c.system.includes('Agent: Medication & Interactions') && c.user.includes('The Advocate asks you'));
  assert.ok(medRead && !medRead.user.includes('WEARABLE'));
});

test('a dose the model lets through is caught in code', async () => {
  stubModel({ composeText: 'Keep going. Take 5000 IU of vitamin D3 daily with food.' });
  const events = [];
  const { reply } = await runQuestion({ question: 'How much vitamin D should I take?', facts, healthData: {}, run: { ledger: [] } }, (e) => events.push(e));
  const done = events.find((e) => e.type === 'safety_done');
  assert.ok(events.some((e) => e.type === 'safety_flag'));
  assert.equal(done.revised, true);
  assert.doesNotMatch(reply, /5000 IU/);
});

test('crisis language skips the team and answers with 988 at once', async () => {
  const calls = stubModel({ composeText: '' });
  const events = [];
  const { reply } = await runQuestion({ question: 'I want to kill myself', facts, healthData: {}, run: { ledger: [] } }, (e) => events.push(e));
  assert.equal(calls.length, 0);
  assert.match(reply, /988/);
  assert.equal(events.at(-1).type, 'answer');
});

// Live, Oct 20: "can you evaluate my genetics report?" went to Medication alone, and a
// member on no drugs got a pharmacogenomics answer. Genetics is forced in on DNA words
// and reads the whole genetics record.
test('a genetics question brings in the Genetics specialist, who reads the DNA report', async () => {
  const calls = stubModel({ composeText: 'Your report lists **APOE e3/e4**.' });
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.messages[0].content.includes('Agent: My Advocate (the manager)')) {
      const content = JSON.stringify({ reason: 'r', consult: [{ id: 'medications', ask: 'Any gene-drug flags?' }] });
      return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
    }
    return real(url, init);
  };
  const withDna = { ...facts, sections: [...facts.sections, { key: 'genetics', title: 'GENETICS', body: '- APOE · genotype e3/e4 · rs429358' }] };
  const events = [];
  await runQuestion({ question: 'can you evaluate my genetics report?', facts: withDna, healthData: {}, run: { auth: null, ledger: [] } }, (e) => events.push(e));
  assert.deepEqual(events.find((e) => e.type === 'route_done').consult.map((c) => c.id), ['medications', 'genetics']);
  const read = calls.find((c) => c.system.includes('Agent: Genetics'));
  assert.ok(read, 'the Genetics brief was called');
  assert.match(read.user, /GENETICS\n- APOE/);
  // The fact-checker can trace a genotype to the record, not only labs and medications.
  const check = calls.find((c) => c.system.includes('Agent: Safety Review'));
  assert.match(check.user, /GENETICS\n- APOE/);
});

// Live, Oct 20: a member's DNA report was their oldest upload, behind seven lab PDFs,
// and the shared document budget ran out before it. Genetic reports have their own
// section, and the Genetics specialist always gets it.
test('the Genetics specialist reads the DNA report however many labs came after it', async () => {
  // healthContext.js uses the app's extensionless imports, so its side is read as source.
  const { readFileSync } = await import('node:fs');
  const ctx = readFileSync(new URL('../../src/lib/healthContext.js', import.meta.url), 'utf8');
  assert.match(ctx, /const records = documentLines\(allRecords\.filter\(\(r\) => !isGenetic\(r\)\)\)/, 'the shared budget excludes DNA reports');
  assert.match(ctx, /key: "geneticDocuments"[^\n]*body: geneticRecords/, 'DNA reports have their own section');
  const built = {
    preamble: '',
    sections: [
      { key: 'documents', title: 'UPLOADED RECORDS & DOCUMENTS', body: '- Quest Bloodwork: stored, but not included here' },
      { key: 'geneticDocuments', title: 'GENETIC REPORTS', body: '- AncestryDNA Longevity Report — full text follows:\n"""\nFOXO3 rs2802288 AG\n"""' },
    ],
  };
  const slice = factsFor(built, TEAM.genetics.facts);
  assert.match(slice, /GENETIC REPORTS[\s\S]*FOXO3 rs2802288 AG/);
  assert.doesNotMatch(slice, /Quest Bloodwork/, 'lab PDFs are not in the Genetics slice');
  assert.match(factsFor(built, TEAM.medications.facts), /FOXO3 rs2802288 AG/, 'Medication reads it too, for PGx reports');
});

test('factsFor hands over only the named sections, with the date preamble', () => {
  const text = factsFor(facts, TEAM.medications.facts);
  assert.match(text, /TODAY'S DATE/);
  assert.match(text, /MEDICATIONS/);
  assert.doesNotMatch(text, /WEARABLE/);
});

test('library citations the team was never given are removed', async () => {
  const { scrubInventedCitations } = await import('../lib/knowledge.mjs');
  const live = 'Your level is 28 ng/mL, below the commonly recommended range ([R34] "Vitamin D: targets and therapies"). Absorption may matter ([R35] "Factors that impact vitamin D status").';
  assert.equal(scrubInventedCitations(live, []), 'Your level is 28 ng/mL, below the commonly recommended range. Absorption may matter.');
  const kept = 'Aim lower (per "LDL-C targets by risk tier"). Not this (per "Made Up Guide").';
  assert.equal(scrubInventedCitations(kept, ['LDL-C targets by risk tier']), 'Aim lower (per "LDL-C targets by risk tier"). Not this.');
});

test('a specialist reply that is only the screen block still counts as a report', async () => {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    let content = "## For the member's screen\nHeadline: HRV a little low\nFinding: Our member's 7-day HRV is 47 ms vs 49 baseline.\nFlag: ok";
    if (system.includes('Agent: My Advocate (the manager)')) content = JSON.stringify({ reason: 'r', consult: [{ id: 'lifestyle', ask: 'HRV trend?' }] });
    else if (system.includes('Agent: Safety Review')) content = 'All claims supported.';
    else if (system.includes('My Advocate, writing the answer')) content = 'Your HRV is 47 ms this week.';
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), { status: 200 });
  };
  const events = [];
  await runQuestion({ question: 'How is my HRV this week?', facts, healthData: {}, run: { ledger: [] } }, (e) => events.push(e));
  const done = events.find((e) => e.type === 'specialist_done');
  assert.equal(done.failed, undefined);
  assert.equal(done.headline, 'HRV a little low');
});

test('specialists report in the order they finish, not the order they were called', async () => {
  // Bloodwork is asked first but takes longest; Medication must report before it.
  stubModel({ composeText: 'Your newest vitamin D is 74 ng/mL.', delay: { 'Agent: Bloodwork': 60 } });
  const events = [];
  await runQuestion({ question: 'Is my vitamin D supplement working?', facts, healthData: {}, run: { ledger: [] } }, (e) => events.push(e));
  const starts = events.filter((e) => e.type === 'specialist_start').map((e) => e.id);
  const dones = events.filter((e) => e.type === 'specialist_done').map((e) => e.id);
  assert.deepEqual(starts, ['bloodwork', 'medications']);
  assert.deepEqual(dones, ['medications', 'bloodwork']);
  // Both starts went out together, before either report.
  const lastStart = events.findLastIndex((e) => e.type === 'specialist_start');
  const firstDone = events.findIndex((e) => e.type === 'specialist_done');
  assert.ok(lastStart < firstDone);
  // The draft says what it really used: no web research.
  assert.equal(events.find((e) => e.type === 'draft_start').research, false);
});

test('the bottom line keeps two bold sentences and moves the rest to plain text', async () => {
  const { tidyBottomLine } = await import('../lib/team.mjs');
  const live = "**Your vitamin D is still low at 28 ng/mL (Jun 2026). You take D3 daily. It is time to check with your provider.**\n\n## What we found\n- Vitamin D **28 ng/mL**";
  assert.equal(tidyBottomLine(live), "**Your vitamin D is still low at 28 ng/mL (Jun 2026). You take D3 daily.**\n\nIt is time to check with your provider.\n\n## What we found\n- Vitamin D **28 ng/mL**");
  const short = "**Your vitamin D is 74 ng/mL (Sep 2026), in range.**\n\n## What we found";
  assert.equal(tidyBottomLine(short), short);
});

// Live, Oct 21: an empty account was offered "What should I discuss with my doctor
// about my thyroid trend?" with no labs on file. Suggestions name only data we hold.
test('the chat suggests questions only about data the member has', async () => {
  const { startingPrompts } = await import('../../src/lib/chatPrompts.js');
  const empty = startingPrompts({ labs: [], genetics: [] }, {}).join(' ');
  assert.doesNotMatch(empty, /thyroid|vitamin D|readiness|genetics|medications|bloodwork/i);
  assert.match(empty, /upload first/);
  const full = startingPrompts({ labs: [{ name: 'TSH' }], genetics: [{ gene: 'FOXO3' }] }, { intake: { medications: ['DHEA'] } }).join(' ');
  assert.match(full, /thyroid results/);
  assert.match(full, /genetics report/);
  assert.match(full, /medications or supplements/);
});

// A prompt asks for traceable numbers; this enforces it on the insight cards.
test('an insight card number the model was never given is caught', async () => {
  const { untracedNumbers } = await import('../../src/lib/numberTrace.js');
  const source = '- Vitamin D, 25-OH: 41 ng/mL (drawn 2026-09-17)\n- LDL: 1,042.5 mg/dL';
  assert.deepEqual(untracedNumbers('Your vitamin D of 41 ng/mL (Sep 2026) is in range.', source), []);
  assert.deepEqual(untracedNumbers('Your vitamin D of 28 ng/mL is low.', source), ['28']);
  assert.deepEqual(untracedNumbers('LDL 1042.50 across 3 panels, 7-day trend', source), [], 'formatting and small counts pass');
  assert.deepEqual(untracedNumbers('HRV 48 ms', source), ['48']);
});

// The fact-checker is a model; this is the code backstop behind it. A value the team
// was never handed gets one revision and, if it survives, a row in the safety log.
test('a number in the answer that is not in the record is revised and logged', async () => {
  const calls = stubModel({ composeText: 'Your newest vitamin D is **74 ng/mL** (Sep 17 2026), and your HRV is **48 ms**.' });
  const run = { auth: null, ledger: [] };
  const events = [];
  await runQuestion({ question: 'Is my vitamin D low?', facts, healthData: {}, run }, (e) => events.push(e));
  assert.ok(events.some((e) => e.type === 'safety_flag' && /48/.test(e.problem)), 'the stray number is flagged');
  assert.ok(calls.some((c) => /NUMBER: "48"/.test(c.user)), 'the Advocate is asked to remove it');
  const row = run.safety.find((s) => /Code number trace/.test(s.rule));
  assert.match(row.rule, /NOT cleared: 48/, 'the stub writes it again, so the log says it went out');
});

test('an answer whose numbers all come from the record is not touched by the trace', async () => {
  stubModel({ composeText: 'Your newest vitamin D is **74 ng/mL** (Sep 17 2026).' });
  const run = { auth: null, ledger: [] };
  await runQuestion({ question: 'Is my vitamin D low?', facts, healthData: {}, run }, () => {});
  assert.ok(!(run.safety || []).some((s) => /Code number trace/.test(s.rule)));
});

// The chat had no biological age to quote, so it contradicted Home or computed its own.
test('the biological age Home shows is in the record the team and the fact-checker read', async () => {
  const { readFileSync } = await import('node:fs');
  const { checkKeysFor } = await import('../lib/team.mjs');
  const ctx = readFileSync(new URL('../../src/lib/healthContext.js', import.meta.url), 'utf8');
  assert.match(ctx, /key: "bioAge"[^\n]*body: bioAgeLines\(healthData, userProfile\)/);
  assert.match(ctx, /import \{ bioAgeFromLabs \} from "\.\/phenoAge"/, 'the same calculator as the Home card');
  assert.ok(TEAM.bloodwork.facts.includes('bioAge'));
  assert.ok(TEAM.lifestyle.facts.includes('bioAge'));
  assert.ok(checkKeysFor(['general']).includes('bioAge'));
});

test('a number the member said themself is not treated as invented', async () => {
  stubModel({ composeText: 'You mentioned a home reading of **152/96**; your newest vitamin D is **74 ng/mL**.' });
  const run = { auth: null, ledger: [] };
  await runQuestion({ question: 'My blood pressure was 152/96 this morning, is that a problem?', facts, healthData: {}, run }, () => {});
  assert.ok(!(run.safety || []).some((s) => /Code number trace/.test(s.rule)));
});
