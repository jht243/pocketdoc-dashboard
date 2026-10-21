// Routing lanes (DESIGN step 5): every marker's boundaries in library/escalation.json,
// unit matching, sex-specific rules, the eGFR trend rule, the Section 9 emergency
// overrides, and the lane cards reaching compose. The thresholds are the matrix's and
// are asserted here as written; they await medical-director approval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MATRIX, laneFor, lanesFor, emergencyFor, emergencyMessage, laneBlock, markerFor, canonUnit, sameUnit,
} from '../lib/escalation.mjs';
import { violatesForbiddenOutput } from '../../src/lib/clinicalRules.js';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { runQuestion } = await import('../lib/team.mjs');

const unitOf = (m) => MATRIX.markers[m].unit;
/** [lane, level] for one value in the matrix's own unit. */
const at = (marker, value, extra = {}) => {
  const c = laneFor({ marker, value, unit: unitOf(marker), ...extra });
  return [c.lane, c.level];
};
const SELF = ['self', null];
const FLAG = ['provider', 'flag'];
const NOW = ['provider', 'immediate'];

test('the matrix is the file on disk, unchanged by the code', () => {
  const disk = JSON.parse(readFileSync(new URL('../library/escalation.json', import.meta.url), 'utf8'));
  assert.deepEqual(MATRIX, disk);
  assert.equal(MATRIX.approved_by, 'Dr. Adam Locker, 2026-10-21');
});

test('fasting glucose: 99 self, 100 and 125 flag, 126 immediate', () => {
  assert.deepEqual(at('fasting_glucose', 99), SELF);
  assert.deepEqual(at('fasting_glucose', 100), FLAG);
  assert.deepEqual(at('fasting_glucose', 125), FLAG);
  assert.deepEqual(at('fasting_glucose', 125.9), FLAG);
  assert.deepEqual(at('fasting_glucose', 126), NOW);
  assert.equal(laneFor({ marker: 'fasting_glucose', value: 99, unit: 'mg/dL' }).inSelfRange, true);
  assert.equal(laneFor({ marker: 'fasting_glucose', value: 65, unit: 'mg/dL' }).inSelfRange, false);
});

test('HbA1c: 5.6 self, 5.7 and 6.4 flag, 6.5 immediate', () => {
  assert.deepEqual(at('hba1c', 5.6), SELF);
  assert.deepEqual(at('hba1c', 5.7), FLAG);
  assert.deepEqual(at('hba1c', 6.4), FLAG);
  assert.deepEqual(at('hba1c', 6.5), NOW);
  // "% of total Hgb" is how some labs print the same unit.
  assert.equal(laneFor({ marker: 'hba1c', value: 6.6, unit: '% of total Hgb' }).level, 'immediate');
});

test('fasting insulin: 19.9 self, 20 and 29.9 flag, 30 immediate', () => {
  assert.deepEqual(at('fasting_insulin', 19.9), SELF);
  assert.deepEqual(at('fasting_insulin', 20), FLAG);
  assert.deepEqual(at('fasting_insulin', 29.9), FLAG);
  assert.deepEqual(at('fasting_insulin', 30), NOW);
  // µIU/mL and mIU/L are the same unit spelled differently.
  assert.equal(laneFor({ marker: 'fasting_insulin', value: 31, unit: 'µIU/mL' }).level, 'immediate');
  assert.equal(laneFor({ marker: 'fasting_insulin', value: 31, unit: 'mIU/L' }).level, 'immediate');
});

test('triglycerides: 199 self, 200 and 499 flag, 500 immediate', () => {
  assert.deepEqual(at('triglycerides', 199), SELF);
  assert.deepEqual(at('triglycerides', 200), FLAG);
  assert.deepEqual(at('triglycerides', 499), FLAG);
  assert.deepEqual(at('triglycerides', 500), NOW);
});

test('HDL: 35 self, 34.9 flag; the self range is sex-specific', () => {
  assert.deepEqual(at('hdl', 35), SELF);
  assert.deepEqual(at('hdl', 34.9), FLAG);
  // Guideline cut-offs (Oct 19 2026): 40+ for men, 50+ for women.
  assert.equal(laneFor({ marker: 'hdl', value: 45, unit: 'mg/dL', sex: 'male' }).inSelfRange, true);
  assert.equal(laneFor({ marker: 'hdl', value: 45, unit: 'mg/dL', sex: 'female' }).inSelfRange, false);
  assert.equal(laneFor({ marker: 'hdl', value: 55, unit: 'mg/dL' }).inSelfRange, null);
});

test('hs-CRP in mg/L: 2.9 self, 3.0 and 9.9 flag, 10.0 immediate', () => {
  assert.deepEqual(at('hs_crp', 2.9), SELF);
  assert.deepEqual(at('hs_crp', 3.0), FLAG);
  assert.deepEqual(at('hs_crp', 9.9), FLAG);
  assert.deepEqual(at('hs_crp', 10.0), NOW);
  assert.equal(laneFor({ marker: 'hs_crp', value: '<0.3', unit: 'mg/L' }).inSelfRange, true);
  // A CRP printed in mg/dL is converted exactly (x10) and routed, never left
  // unrouted and never compared 10x off: 0.5 mg/dL is 5 mg/L, a provider flag.
  const dl = laneFor({ marker: 'hs_crp', value: 0.5, unit: 'mg/dL' });
  assert.equal(dl.value, 5);
  assert.equal(dl.lane, 'provider');
  assert.equal(dl.level, 'flag');
  assert.equal(laneFor({ marker: 'hs_crp', value: 1.2, unit: 'mg/dL' }).level, 'immediate');
  assert.equal(laneFor({ marker: 'hs_crp', value: 0.1, unit: 'mg/dL' }).lane, 'self');
});

test('homocysteine: 19.9 self, 20 flag', () => {
  assert.deepEqual(at('homocysteine', 19.9), SELF);
  assert.deepEqual(at('homocysteine', 20), FLAG);
  assert.equal(laneFor({ marker: 'homocysteine', value: 21, unit: 'µmol/L' }).level, 'flag');
});

test('eGFR: below 60 is immediate on one draw', () => {
  assert.deepEqual(at('egfr', 60), SELF);
  assert.deepEqual(at('egfr', 59), NOW);
  assert.deepEqual(at('egfr', 59, { previous: { value: 50, unit: 'mL/min/1.73m2' } }), NOW);
  assert.equal(laneFor({ marker: 'egfr', value: 59, unit: 'mL/min/{1.73_m2}' }).level, 'immediate');
});

test('eGFR: below 90 is a flag only when it declined from the draw before', () => {
  const u = 'mL/min/1.73m2';
  assert.deepEqual(at('egfr', 75), SELF, 'one draw: no trend, no flag');
  assert.deepEqual(at('egfr', 75, { previous: { value: 82, unit: u } }), FLAG, 'declining');
  assert.deepEqual(at('egfr', 75, { previous: { value: 75, unit: u } }), SELF, 'flat is not declining');
  assert.deepEqual(at('egfr', 75, { previous: { value: 70, unit: u } }), SELF, 'rising');
  assert.deepEqual(at('egfr', 89.9, { previous: { value: 95, unit: u } }), FLAG);
  assert.deepEqual(at('egfr', 90, { previous: { value: 99, unit: u } }), SELF, 'the rule is lt 90');
  assert.deepEqual(at('egfr', 75, { previous: { value: 82, unit: 'mL/s' } }), SELF, 'a prior draw in another unit is no trend');
  const c = laneFor({ marker: 'egfr', value: 75, unit: u, previous: { value: 82, unit: u, date: 'Mar 2026' } });
  assert.equal(c.trigger, 'ESC-02');
  assert.equal(c.previous.value, 82);
});

test('creatinine: above the lab\'s own printed upper limit is a flag', () => {
  assert.deepEqual(at('creatinine', 1.0, { labRange: '0.57-1.00' }), SELF);
  assert.deepEqual(at('creatinine', 1.01, { labRange: '0.57-1.00' }), FLAG);
  assert.deepEqual(at('creatinine', 1.2, { labRange: '0.76–1.27' }), SELF);
  assert.deepEqual(at('creatinine', 1.3, { labRange: '<1.27' }), FLAG);
  assert.deepEqual(at('creatinine', 3.0), SELF, 'no printed range: lab_high cannot be read, so no rule fires');
  assert.equal(laneFor({ marker: 'creatinine', value: 0.65, unit: 'mg/dL', sex: 'female' }).inSelfRange, true);
  assert.equal(laneFor({ marker: 'creatinine', value: 0.65, unit: 'mg/dL', sex: 'male' }).inSelfRange, false);
});

test('albumin: 4.0 self, 3.5 and 3.9 flag, 3.4 immediate (immediate is checked first)', () => {
  assert.deepEqual(at('albumin', 4.0), SELF);
  assert.deepEqual(at('albumin', 3.9), FLAG);
  assert.deepEqual(at('albumin', 3.5), FLAG);
  assert.deepEqual(at('albumin', 3.4), NOW);
});

test('ALT: 40 self, 41 and 80 flag, 81 immediate', () => {
  assert.deepEqual(at('alt', 40), SELF);
  assert.deepEqual(at('alt', 41), FLAG);
  assert.deepEqual(at('alt', 80), FLAG);
  assert.deepEqual(at('alt', 81), NOW);
  assert.equal(laneFor({ marker: 'alt', value: 81, unit: 'IU/L' }).level, 'immediate');
});

test('RDW: 15.0 self, 15.1 flag', () => {
  assert.deepEqual(at('rdw', 15.0), SELF);
  assert.deepEqual(at('rdw', 15.1), FLAG);
});

test('WBC: 3.0 to 11.0 self, 2.9 immediate, 11.1 flag; K/uL is the same unit', () => {
  assert.deepEqual(at('wbc', 3.0), SELF);
  assert.deepEqual(at('wbc', 2.9), NOW);
  assert.deepEqual(at('wbc', 11.0), SELF);
  assert.deepEqual(at('wbc', 11.1), FLAG);
  assert.equal(laneFor({ marker: 'wbc', value: 11.1, unit: 'K/uL' }).level, 'flag');
  assert.equal(laneFor({ marker: 'wbc', value: 11.1, unit: 'x10E3/uL' }).level, 'flag');
  assert.equal(laneFor({ marker: 'wbc', value: 11100, unit: 'cells/uL' }).lane, null, 'an absolute count is another unit');
});

test('vitamin D: 20 and 100 self, 19.9 and 100.1 flag', () => {
  assert.deepEqual(at('vitamin_d_25oh', 20), SELF);
  assert.deepEqual(at('vitamin_d_25oh', 19.9), FLAG);
  assert.deepEqual(at('vitamin_d_25oh', 100), SELF);
  assert.deepEqual(at('vitamin_d_25oh', 100.1), FLAG);
  // Guideline range 20–50 (Oct 19 2026): 74 is self-lane but outside it.
  assert.equal(laneFor({ marker: 'vitamin_d_25oh', value: 74, unit: 'ng/mL' }).inSelfRange, false);
  assert.equal(laneFor({ marker: 'vitamin_d_25oh', value: 35, unit: 'ng/mL' }).inSelfRange, true);
  assert.equal(laneFor({ marker: 'vitamin_d_25oh', value: 50, unit: 'nmol/L' }).lane, null, 'nmol/L is not converted');
});

test('ferritin: high is 300 for women and 400 for men', () => {
  assert.deepEqual(at('ferritin', 300, { sex: 'female' }), SELF);
  assert.deepEqual(at('ferritin', 301, { sex: 'female' }), FLAG);
  assert.deepEqual(at('ferritin', 301, { sex: 'male' }), SELF);
  assert.deepEqual(at('ferritin', 400, { sex: 'male' }), SELF);
  assert.deepEqual(at('ferritin', 401, { sex: 'male' }), FLAG);
  assert.deepEqual(at('ferritin', 350, { sex: 'F' }), FLAG, 'any spelling of sex');
  assert.deepEqual(at('ferritin', 350, { sex: 'Male' }), SELF);
  assert.deepEqual(at('ferritin', 20, { sex: 'female' }), SELF);
  assert.deepEqual(at('ferritin', 19, { sex: 'male' }), FLAG, 'low applies to both');
  assert.equal(laneFor({ marker: 'ferritin', value: 175, unit: 'ng/mL', sex: 'male' }).inSelfRange, true);
  assert.equal(laneFor({ marker: 'ferritin', value: 175, unit: 'ng/mL', sex: 'female' }).inSelfRange, false);
});

test('ferritin with no sex on file: the lower threshold escalates, and says so', () => {
  const c = laneFor({ marker: 'ferritin', value: 350, unit: 'ng/mL' });
  assert.equal(c.level, 'flag');
  assert.match(c.note, /female threshold/);
  assert.deepEqual(at('ferritin', 300), SELF);
});

test('ApoB: 120 self, 121 flag', () => {
  assert.deepEqual(at('apob', 120), SELF);
  assert.deepEqual(at('apob', 121), FLAG);
});

test('Lp(a) is always provider; mg/dL above 50 is immediate; nmol/L is never converted', () => {
  assert.deepEqual(at('lpa', 10), FLAG);
  assert.equal(laneFor({ marker: 'lpa', value: 10, unit: 'mg/dL' }).trigger, 'ESC-06');
  assert.deepEqual(at('lpa', 50), FLAG);
  assert.deepEqual(at('lpa', 51), NOW);
  // 120 nmol/L is not "above 50 mg/dL" and is not turned into mg/dL. It still goes to
  // the provider, because Lp(a) does whatever its value; the threshold is not applied.
  const n = laneFor({ marker: 'lpa', value: 120, unit: 'nmol/L' });
  assert.equal(n.lane, 'provider');
  assert.equal(n.level, 'flag');
  assert.equal(n.thresholdsApplied, false);
  assert.equal(n.value, 120);
});

test('a unit other than the matrix\'s, or none, gets no lane', () => {
  for (const [marker, value, unit] of [
    ['fasting_glucose', 7.2, 'mmol/L'], ['fasting_glucose', 140, ''], ['hba1c', 48, 'mmol/mol'],
    ['triglycerides', 2.5, 'mmol/L'], ['creatinine', 90, 'umol/L'], ['albumin', 40, 'g/L'],
    ['homocysteine', 25, 'mg/dL'], ['apob', 1.3, 'g/L'],
  ]) {
    const c = laneFor({ marker, value, unit });
    assert.equal(c.lane, null, `${marker} ${value} ${unit}`);
    assert.equal(c.unmatched, 'unit');
  }
});

test('unknown markers and non-numeric values get no card', () => {
  assert.equal(laneFor({ marker: 'tsh', value: 2, unit: 'mIU/L' }), null);
  assert.equal(laneFor({ marker: 'ferritin', value: 'see note', unit: 'ng/mL' }), null);
});

test('the app\'s lab names map to matrix markers, and their look-alikes do not', () => {
  const cases = {
    'Glucose': 'fasting_glucose', 'Fasting Glucose': 'fasting_glucose', 'Hemoglobin A1c': 'hba1c', 'HbA1c': 'hba1c',
    'Insulin': 'fasting_insulin', 'Triglycerides': 'triglycerides', 'HDL Cholesterol': 'hdl', 'hs-CRP': 'hs_crp',
    'C-Reactive Protein, Cardiac': 'hs_crp', 'Homocysteine': 'homocysteine', 'eGFR': 'egfr', 'Creatinine': 'creatinine',
    'Albumin': 'albumin', 'ALT (SGPT)': 'alt', 'RDW': 'rdw', 'WBC': 'wbc', 'White Blood Cell Count': 'wbc',
    'Vitamin D, 25-OH': 'vitamin_d_25oh', 'Vitamin D, 25-Hydroxy': 'vitamin_d_25oh', 'Ferritin': 'ferritin',
    'ApoB': 'apob', 'Apolipoprotein B': 'apob', 'Lp(a)': 'lpa', 'Lipoprotein (a)': 'lpa',
    'Non-HDL Cholesterol': null, 'Estimated Average Glucose': null, 'Glucose, Urine': null, 'BUN/Creatinine Ratio': null,
    'Albumin/Globulin Ratio': null, 'Microalbumin, Urine': null, 'RDW-SD': null, 'Insulin-like Growth Factor 1': null,
    'Vitamin D, 1,25-Dihydroxy': null, 'TSH': null, 'LDL Cholesterol': null,
  };
  for (const [name, id] of Object.entries(cases)) assert.equal(markerFor(name), id, name);
});

test('unit spellings are compared, never converted', () => {
  assert.ok(sameUnit('µIU/mL', 'uIU/mL'));
  assert.ok(sameUnit('mL/min/1.73 m²', 'mL/min/1.73m2'));
  assert.ok(sameUnit('K/uL', 'x10^9/L'));
  assert.ok(sameUnit('IU/L', 'U/L'));
  assert.ok(!sameUnit('nmol/L', 'mg/dL'));
  assert.ok(!sameUnit('mg/dL', 'mg/L'));
  assert.ok(!sameUnit('', ''));
  assert.equal(canonUnit('MG/DL'), 'mg/dl');
});

/* ---------------- Section 9 ---------------- */

const T = Date.parse('2026-10-18T12:00:00Z');
const lab = (name, value, unit, drawnOn = '2026-10-01') => ({ name, value, unit, drawnOn, date: drawnOn });

test('emergency overrides fire strictly past each Section 9 limit', () => {
  const cases = [
    ['ALT', 200, 201, 'U/L', 'alt'],
    ['WBC', 20, 20.1, 'x10^9/L', 'wbc'],
    ['Glucose', 300, 301, 'mg/dL', 'fasting_glucose'],
    ['Ferritin', 1000, 1001, 'ng/mL', 'ferritin'],
  ];
  for (const [name, edge, past, unit, marker] of cases) {
    assert.equal(emergencyFor([lab(name, edge, unit)], { now: T }).length, 0, `${name} ${edge}`);
    const [hit] = emergencyFor([lab(name, past, unit)], { now: T });
    assert.equal(hit?.marker, marker, `${name} ${past}`);
    assert.equal(hit.fresh, true);
  }
  assert.equal(emergencyFor([lab('eGFR', 30, 'mL/min/1.73m2')], { now: T }).length, 0);
  assert.equal(emergencyFor([lab('eGFR', 29, 'mL/min/1.73m2')], { now: T })[0].marker, 'egfr');
  assert.equal(emergencyFor([lab('WBC', 21, 'K/uL')], { now: T }).length, 1, 'same unit, other spelling');
  assert.equal(emergencyFor([lab('Ferritin', '>1000', 'ng/mL')], { now: T }).length, 1, 'a ">" result is past its number');
});

test('emergency overrides need the rule\'s unit and read only the newest reading', () => {
  assert.equal(emergencyFor([lab('Glucose', 17, 'mmol/L')], { now: T }).length, 0);
  assert.equal(emergencyFor([lab('Glucose', 350, '')], { now: T }).length, 0);
  assert.equal(emergencyFor([lab('ALT', 250, 'U/L', '2026-03-01'), lab('ALT', 30, 'U/L', '2026-09-30')], { now: T }).length, 0);
  const many = emergencyFor([lab('ALT', 250, 'U/L'), lab('eGFR', 22, 'mL/min/1.73m2'), lab('Vitamin D, 25-OH', 15, 'ng/mL')], { now: T });
  assert.deepEqual(many.map((h) => h.marker).sort(), ['alt', 'egfr']);
});

test('an emergency value older than 90 days, or undated, is a recheck, not an emergency', () => {
  assert.equal(emergencyFor([lab('ALT', 250, 'U/L', '2026-01-02')], { now: T })[0].fresh, false);
  assert.equal(emergencyFor([{ name: 'ALT', value: 250, unit: 'U/L' }], { now: T })[0].fresh, false);
  assert.equal(emergencyFor([lab('ALT', 250, 'U/L', '2026-07-21')], { now: T })[0].fresh, true);
});

test('the hard-coded emergency message names the values and breaks no clinical rule', () => {
  const msg = emergencyMessage(emergencyFor([lab('ALT', 250, 'U/L'), lab('Ferritin', 1200, 'ng/mL')], { now: T }));
  assert.match(msg, /ALT 250 U\/L/);
  assert.match(msg, /Ferritin 1200 ng\/mL/);
  assert.match(msg, /urgent care/);
  assert.equal(violatesForbiddenOutput(msg), null);
});

/* ---------------- the whole record ---------------- */

test('lanesFor routes the newest reading of each marker, provider lane first', () => {
  const labs = [
    lab('Glucose', 92, 'mg/dL', '2025-09-01'),
    lab('Glucose', 112, 'mg/dL', '2026-09-17'),
    lab('Ferritin', 340, 'ng/mL', '2026-09-17'),
    lab('Vitamin D, 25-OH', 74, 'ng/mL', '2026-09-17'),
    lab('hs-CRP', 11, 'mg/L', '2026-09-17'),
    lab('TSH', 2.1, 'mIU/L', '2026-09-17'),
    lab('Lp(a)', 140, 'nmol/L', '2026-09-17'),
  ];
  const cards = lanesFor(labs, { sex: 'male', now: T });
  const by = Object.fromEntries(cards.map((c) => [c.marker, c]));
  assert.deepEqual(cards.map((c) => c.marker), ['hs_crp', 'fasting_glucose', 'lpa', 'ferritin', 'vitamin_d_25oh']);
  assert.equal(by.fasting_glucose.value, 112, 'newest draw, not the older 92');
  assert.equal(by.fasting_glucose.level, 'flag');
  assert.equal(by.ferritin.lane, 'self', '340 is under the male threshold');
  assert.equal(lanesFor(labs, { sex: 'female', now: T }).find((c) => c.marker === 'ferritin').lane, 'provider');
  assert.equal(by.hs_crp.level, 'immediate');
  assert.equal(by.lpa.lane, 'provider');
  assert.equal(by.tsh, undefined, 'not in the matrix');
});

test('lanesFor reads the eGFR trend from the previous draw date, not a re-upload of the same one', () => {
  const u = 'mL/min/1.73m2';
  const declining = lanesFor([lab('eGFR', 84, u, '2026-03-01'), lab('eGFR', 76, u, '2026-09-17')], { now: T });
  assert.equal(declining[0].level, 'flag');
  assert.equal(declining[0].previous.value, 84);
  const reupload = lanesFor([lab('eGFR', 84, u, '2026-09-17'), lab('eGFR', 76, u, '2026-09-17')], { now: T });
  assert.equal(reupload[0].lane, 'self');
  const rising = lanesFor([lab('eGFR', 70, u, '2026-03-01'), lab('eGFR', 76, u, '2026-09-17')], { now: T });
  assert.equal(rising[0].lane, 'self');
});

test('the lane block tells compose each lane and marks old readings', () => {
  const block = laneBlock(lanesFor([
    lab('Glucose', 127, 'mg/dL', '2024-05-01'),
    lab('Vitamin D, 25-OH', 74, 'ng/mL', '2026-09-17'),
    lab('Triglycerides', 3.1, 'mmol/L', '2026-09-17'),
  ], { now: T }));
  assert.match(block, /### Bring this to your provider\n- Fasting glucose 127 mg\/dL \(2024-05-01, .*HISTORICAL.*\): IMMEDIATE/);
  assert.match(block, /### You can act on this\n- Vitamin D, 25-OH 74 ng\/mL/);
  assert.match(block, /### Unrouted\n- Triglycerides 3.1 mmol\/L .*no lane was assigned/);
  assert.equal(laneBlock([]), '');
});

/* ---------------- the pipeline ---------------- */

const facts = {
  preamble: "TODAY'S DATE: 2026-10-18",
  sections: [
    { key: 'profile', title: 'USER PROFILE', body: '- Sex at birth / recorded sex: female' },
    { key: 'labs', title: 'LAB RESULTS', body: '- Ferritin: 340 ng/mL (drawn 2026-09-17)' },
  ],
};

function stubModel() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const user = body.messages.at(-1).content;
    calls.push({ system, user });
    let content;
    if (system.includes('Agent: My Advocate (the manager)')) content = JSON.stringify({ reason: 'Your ferritin is a lab question.', consult: [{ id: 'bloodwork', ask: 'Is ferritin 340 high?' }] });
    else if (system.includes('Agent: Safety Review')) content = 'All claims supported.';
    else if (system.includes('My Advocate, writing the answer')) content = 'Your ferritin is **340 ng/mL** (Sep 17 2026).\n\n## Bring this to your provider\n- Ferritin 340 ng/mL.';
    else content = 'Read.\n\n## For the member\'s screen\nHeadline: Ferritin is high\nFinding: Our member\'s ferritin is 340 ng/mL.\nFlag: watch';
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  };
  return calls;
}

test('compose is handed the lane cards computed in code', async () => {
  const calls = stubModel();
  const healthData = { sex: 'female', labs: [lab('Ferritin', 340, 'ng/mL', '2026-09-17')] };
  const out = await runQuestion({ question: 'Is my ferritin high?', facts, healthData, run: { auth: null, ledger: [] } }, () => {});
  const composeCall = calls.find((c) => c.system.includes('My Advocate, writing the answer'));
  assert.match(composeCall.user, /## Routing lanes/);
  assert.match(composeCall.user, /### Bring this to your provider\n- Ferritin 340 ng\/mL \(2026-09-17\): flag\. High ferritin/);
  assert.equal(out.lanes[0].marker, 'ferritin');
  assert.equal(out.lanes[0].lane, 'provider');
  // The router and the specialists are never asked to decide a lane.
  const route = calls.find((c) => c.system.includes('Agent: My Advocate (the manager)'));
  assert.doesNotMatch(route.user, /Routing lanes/);
});

test('a fresh Section 9 value bypasses the agents with the hard-coded message', async () => {
  const calls = stubModel();
  const events = [];
  const drawn = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const healthData = { labs: [lab('ALT', 260, 'U/L', drawn)] };
  const out = await runQuestion({ question: 'How is my liver?', facts, healthData, run: { auth: null, ledger: [] } }, (e) => events.push(e));
  assert.equal(calls.length, 0, 'no model call');
  assert.deepEqual(events.map((e) => e.type), ['safety_start', 'safety_done', 'answer']);
  assert.match(out.reply, /ALT 260 U\/L/);
  assert.equal(out.emergency[0].marker, 'alt');
});

// Critical values, Oct 19 2026: two tiers, red flags for "go now", and the markers the
// Access panel runs that were missing.
test('critical values split by urgency and cover potassium, sodium, hemoglobin, platelets, calcium and INR', async () => {
  const { emergencyFor, emergencyMessage } = await import('../lib/escalation.mjs');
  const now = Date.parse('2026-10-19');
  const lab = (name, value, unit) => ({ name, value: String(value), unit, date: '2026-10-15', drawnOn: '2026-10-15' });
  const hits = emergencyFor([
    lab('Potassium', 6.4, 'mEq/L'), lab('Sodium', 150, 'mmol/L'), lab('Hemoglobin', 6.8, 'g/dL'),
    lab('Platelet Count', 40, 'K/uL'), lab('INR', 5.1, ''), lab('eGFR', 25, 'mL/min/1.73m2'),
  ], { now });
  const by = Object.fromEntries(hits.map((h) => [h.name, h.tier]));
  assert.equal(by.Potassium, 'today');
  assert.equal(by.Hemoglobin, 'today');
  assert.equal(by.Platelets, 'today');
  assert.equal(by.INR, 'today');
  assert.ok(!('Sodium' in by), 'sodium 150 is not critical');
  const egfr = hits.find((h) => h.marker === 'egfr');
  assert.equal(egfr.tier, 'this_week');
  const msg = emergencyMessage(hits);
  assert.match(msg, /contact your provider's office today/);
  assert.match(msg, /visit this week/);
  assert.match(msg, /chest pain, trouble breathing, confusion, fainting/);
  const weekOnly = emergencyMessage(hits.filter((h) => h.tier === 'this_week'));
  assert.doesNotMatch(weekOnly, /today/);
  assert.match(weekOnly, /this week/);
});

// Dr. Locker, Oct 18 2026: INR over 4.5 is right, and it must not depend on the member
// being on a blood thinner; an elevated INR without one is the bigger red flag.
test('INR over 4.5 is critical for every member, with no blood-thinner gate', async () => {
  const { emergencyFor } = await import('../lib/escalation.mjs');
  const rule = MATRIX.emergency.rules.find((r) => r.marker === 'inr');
  assert.equal(rule.gt, 4.5);
  assert.equal(rule.pending, undefined, 'signed off, no longer pending');
  const now = Date.parse('2026-10-19');
  const hit = emergencyFor([{ name: 'PT/INR', value: '4.8', unit: 'ratio', date: '2026-10-15', drawnOn: '2026-10-15' }], { now });
  assert.equal(hit.length, 1);
  assert.equal(hit[0].tier, 'today');
  assert.equal(emergencyFor([{ name: 'INR', value: '4.5', unit: '', date: '2026-10-15', drawnOn: '2026-10-15' }], { now }).length, 0);
});
