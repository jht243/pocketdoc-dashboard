// Biological age (Levine PhenoAge): the formula, the spec's worked examples, unit
// conversion, every validation rule, lab-row matching and draw grouping, the
// simulator, and the trend. Numbers are checked against two references written
// independently of the module: a plain transcription of the spec's formula, and the
// full-precision weights from the open-source BioAge R package (phenoage_calc.R,
// orig = TRUE). All of it awaits medical-director approval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHENOAGE_COEFFICIENTS, SIMULATOR_TARGETS, ageOnDate, bioAgeFromLabs, calculatePhenoAge,
  formatYears, groupDraws, improvementLabel, markerForRow, phenoAgeFormula, roundToHalf,
  simulateLevers, simulateScenario, toModelUnits,
} from '../../supabase/functions/_shared/phenoAge.js';

/* ----------------------------------------------------------- references */

/** The spec's formula, transcribed line by line, US units in. */
function specReference(c) {
  const alb = c.albumin * 10;
  const creat = c.creatinine * 88.4;
  const glu = c.glucose / 18.018;
  const lncrp = Math.log(c.crp / 10);
  const xb = -19.907 - 0.0336 * alb + 0.0095 * creat + 0.1953 * glu + 0.0954 * lncrp
    - 0.0120 * c.lymphocytes + 0.0268 * c.mcv + 0.3306 * c.rdw + 0.00188 * c.alp
    + 0.0554 * c.wbc + 0.0804 * c.age;
  const gamma = 0.0076927;
  const M = 1 - Math.exp(-Math.exp(xb) * (Math.exp(120 * gamma) - 1) / gamma);
  return 141.50225 + Math.log(-0.00553 * Math.log(1 - M)) / 0.090165;
}

/** BioAge R package, orig = TRUE: full-precision weights and constants. */
function bioAgePackage(c) {
  const xb = -19.90667 + (-0.03359355 * c.albumin * 10) + (0.009506491 * c.creatinine * 88.4)
    + (0.1953192 * c.glucose / 18.018) + (0.09536762 * Math.log(c.crp / 10))
    + (-0.01199984 * c.lymphocytes) + (0.02676401 * c.mcv) + (0.3306156 * c.rdw)
    + (0.001868778 * c.alp) + (0.05542406 * c.wbc) + (0.08035356 * c.age);
  const m = 1 - Math.exp((-1.51714 * Math.exp(xb)) / 0.007692696);
  return (Math.log(-0.0055305 * Math.log(1 - m)) / 0.090165) + 141.50225;
}

/** The spec's worked example. US units. */
const WORKED = {
  age: 53, albumin: 4.4, creatinine: 0.95, glucose: 98, crp: 1.8,
  lymphocytes: 28, mcv: 91, rdw: 13.6, alp: 78, wbc: 6.4,
};

const FASTING = { fasting: true };

/** A dozen more people, spread across age and every marker's normal-to-abnormal range. */
const CASES = [
  { age: 25, albumin: 4.8, creatinine: 0.8, glucose: 82, crp: 0.3, lymphocytes: 35, mcv: 88, rdw: 12.4, alp: 65, wbc: 5.5 },
  { age: 31, albumin: 4.5, creatinine: 1.1, glucose: 90, crp: 0.6, lymphocytes: 30, mcv: 92, rdw: 12.9, alp: 70, wbc: 6.0 },
  { age: 38, albumin: 4.2, creatinine: 0.7, glucose: 105, crp: 3.4, lymphocytes: 22, mcv: 86, rdw: 13.8, alp: 95, wbc: 8.1 },
  { age: 44, albumin: 4.0, creatinine: 1.0, glucose: 118, crp: 5.2, lymphocytes: 18, mcv: 95, rdw: 14.6, alp: 110, wbc: 9.4 },
  { age: 47, albumin: 4.6, creatinine: 0.9, glucose: 88, crp: 0.5, lymphocytes: 33, mcv: 90, rdw: 12.6, alp: 58, wbc: 4.9 },
  { age: 56, albumin: 3.9, creatinine: 1.3, glucose: 126, crp: 7.5, lymphocytes: 20, mcv: 97, rdw: 15.2, alp: 130, wbc: 10.2 },
  { age: 60, albumin: 4.3, creatinine: 1.0, glucose: 95, crp: 1.2, lymphocytes: 27, mcv: 93, rdw: 13.4, alp: 80, wbc: 6.8 },
  { age: 64, albumin: 4.1, creatinine: 1.5, glucose: 140, crp: 2.8, lymphocytes: 24, mcv: 99, rdw: 14.1, alp: 102, wbc: 7.7 },
  { age: 69, albumin: 4.4, creatinine: 0.85, glucose: 92, crp: 0.9, lymphocytes: 29, mcv: 91, rdw: 13.0, alp: 72, wbc: 5.8 },
  { age: 73, albumin: 3.6, creatinine: 1.8, glucose: 160, crp: 9.5, lymphocytes: 15, mcv: 101, rdw: 16.8, alp: 150, wbc: 11.5 },
  { age: 78, albumin: 4.0, creatinine: 1.1, glucose: 100, crp: 2.0, lymphocytes: 23, mcv: 94, rdw: 14.0, alp: 88, wbc: 6.6 },
  { age: 84, albumin: 3.8, creatinine: 1.2, glucose: 110, crp: 4.0, lymphocytes: 21, mcv: 96, rdw: 14.9, alp: 99, wbc: 7.2 },
  { age: 20, albumin: 5.0, creatinine: 0.75, glucose: 78, crp: 0.2, lymphocytes: 40, mcv: 85, rdw: 11.9, alp: 90, wbc: 5.0 },
];

/* ------------------------------------------------------------- formula */

test('the weights are the spec\'s, as written', () => {
  assert.deepEqual({ ...PHENOAGE_COEFFICIENTS }, {
    intercept: -19.907, albumin: -0.0336, creatinine: 0.0095, glucose: 0.1953, lnCrp: 0.0954,
    lymphocytes: -0.012, mcv: 0.0268, rdw: 0.3306, alp: 0.00188, wbc: 0.0554, age: 0.0804,
  });
});

test('worked example: the 53-year-old reproduces 50.1', () => {
  const r = calculatePhenoAge(WORKED, FASTING);
  assert.equal(r.status, 'ok');
  assert.equal(r.phenoAge, 50.1);
  assert.equal(r.display, '50');
  assert.equal(r.age, 53);
  assert.equal(r.gap, -2.9);
  assert.equal(r.confidence, 'standard');
  // Never the mortality score.
  assert.equal('M' in r || 'mortality' in r || 'm' in r, false);
  assert.ok(Math.abs(specReference(WORKED) - 50.1) < 0.05);
});

for (const [i, c] of CASES.entries()) {
  test(`reference case ${i + 1} (age ${c.age}) matches both independent implementations`, () => {
    const r = calculatePhenoAge(c, FASTING);
    assert.equal(r.status, 'ok');
    // Same weights, independent transcription: equal to the stored decimal.
    assert.ok(Math.abs(r.phenoAge - specReference(c)) <= 0.05, `${r.phenoAge} vs ${specReference(c)}`);
    // Full-precision open-source weights: the spec's rounding costs well under a
    // fifth of a year anywhere in the range.
    assert.ok(Math.abs(r.phenoAge - bioAgePackage(c)) < 0.2, `${r.phenoAge} vs BioAge ${bioAgePackage(c)}`);
  });
}

test('hand-checked: an all-average 50-year-old lands near 50, and worse markers read older', () => {
  const avg = calculatePhenoAge({ ...WORKED, age: 50 }, FASTING).phenoAge;
  assert.ok(avg > 44 && avg < 50, String(avg));
  const worse = calculatePhenoAge({ ...WORKED, age: 50, glucose: 130, crp: 6, rdw: 15.5 }, FASTING).phenoAge;
  assert.ok(worse > avg + 4, `${worse} vs ${avg}`);
  // One year of age, nothing else changed, is a little under one year of PhenoAge.
  const older = calculatePhenoAge({ ...WORKED, age: 54 }, FASTING).phenoAge;
  assert.ok(older - calculatePhenoAge(WORKED, FASTING).phenoAge > 0.7 && older - 50.1 < 1.0);
});

test('the raw formula takes model units and nothing else', () => {
  const raw = phenoAgeFormula({
    albumin: 44, creatinine: 83.98, glucose: 98 / 18.018, crpMgDl: 0.18,
    lymphocytes: 28, mcv: 91, rdw: 13.6, alp: 78, wbc: 6.4, age: 53,
  });
  assert.ok(Math.abs(raw - 50.105) < 0.001, String(raw));
});

/* ----------------------------------------------------------- unit handling */

test('SI units give the same answer as US units', () => {
  const si = calculatePhenoAge({
    ...WORKED,
    albumin: { value: 44, unit: 'g/L' },
    creatinine: { value: 84, unit: 'µmol/L' },
    glucose: { value: 5.44, unit: 'mmol/L' },
    crp: { value: 0.18, unit: 'mg/dL' },
    wbc: { value: 6.4, unit: '10^9/L' },
  }, FASTING);
  assert.equal(si.status, 'ok');
  assert.ok(Math.abs(si.phenoAge - 50.1) <= 0.1, String(si.phenoAge));
});

test('unit conversion factors', () => {
  assert.equal(toModelUnits('albumin', '4.4', 'g/dL').value, 44);
  assert.equal(toModelUnits('albumin', '44', 'g/L').value, 44);
  assert.ok(Math.abs(toModelUnits('creatinine', '0.95', 'mg/dL').value - 83.98) < 1e-9);
  assert.equal(toModelUnits('creatinine', '84', 'umol/L').value, 84);
  assert.ok(Math.abs(toModelUnits('glucose', '98', 'mg/dL').value - 5.439) < 0.001);
  assert.equal(toModelUnits('glucose', '5.4', 'mmol/L').value, 5.4);
  assert.equal(toModelUnits('crp', '1.8', 'mg/L').value, 1.8);
  assert.ok(Math.abs(toModelUnits('crp', '0.18', 'mg/dL').value - 1.8) < 1e-9);
  for (const u of ['K/uL', 'x10E3/uL', '10^3/µL', '10*3/uL', '10^9/L', 'thou/mcL', '']) {
    assert.equal(toModelUnits('wbc', '6.4', u).value, 6.4, u);
  }
  assert.equal(toModelUnits('wbc', '6400', 'cells/uL').value, 6.4);
  // A different measurement under the same name.
  assert.equal(toModelUnits('lymphocytes', '1.8', 'x10E3/uL').error, 'wrong-measurement');
  assert.equal(toModelUnits('rdw', '42', 'fL').error, 'wrong-measurement');
});

test('a probable unit error is not calculated; the member is asked to confirm', () => {
  // 44 g/L entered under g/dL would read as 440 g/L.
  const r = calculatePhenoAge({ ...WORKED, albumin: { value: 44, unit: 'g/dL' } }, FASTING);
  assert.equal(r.status, 'confirm');
  assert.deepEqual(r.problems.map((p) => p.key), ['albumin']);
  assert.match(r.message, /Albumin/);
  assert.equal(r.phenoAge, undefined);
  // Glucose in mmol/L with no unit reads as mg/dL — 5.4 mg/dL is impossible.
  assert.equal(calculatePhenoAge({ ...WORKED, glucose: 5.4 }, FASTING).status, 'confirm');
  // WBC outside 1-30.
  assert.equal(calculatePhenoAge({ ...WORKED, wbc: 64 }, FASTING).status, 'confirm');
  assert.equal(calculatePhenoAge({ ...WORKED, wbc: 0.5 }, FASTING).status, 'confirm');
});

/* ---------------------------------------------------------- validation */

test('all nine markers are required, and the missing test is named', () => {
  const noCbc = { ...WORKED, lymphocytes: null, rdw: undefined };
  const r = calculatePhenoAge(noCbc, FASTING);
  assert.equal(r.status, 'missing');
  assert.deepEqual(r.tests, ['CBC with differential']);
  assert.equal(r.message, 'Add a CBC with differential to see your biological age.');
  const noCrp = calculatePhenoAge({ ...WORKED, crp: '' }, FASTING);
  assert.equal(noCrp.message, 'Add an hs-CRP to see your biological age.');
  const both = calculatePhenoAge({ ...WORKED, crp: null, wbc: null }, FASTING);
  assert.equal(both.message, 'Add a CBC with differential and an hs-CRP to see your biological age.');
});

test('hs-CRP above 10 mg/L is not calculated; a recheck is suggested', () => {
  const r = calculatePhenoAge({ ...WORKED, crp: 12 }, FASTING);
  assert.equal(r.status, 'recheck');
  assert.match(r.message, /2–3 weeks/);
  assert.equal(calculatePhenoAge({ ...WORKED, crp: { value: 1.2, unit: 'mg/dL' } }, FASTING).status, 'recheck');
  assert.equal(calculatePhenoAge({ ...WORKED, crp: 9.9 }, FASTING).status, 'ok');
});

test('hs-CRP below detection uses the lab\'s lower limit, never log(0)', () => {
  const lt = calculatePhenoAge({ ...WORKED, crp: '<0.2' }, FASTING);
  assert.equal(lt.status, 'ok');
  assert.equal(lt.phenoAge, calculatePhenoAge({ ...WORKED, crp: 0.2 }, FASTING).phenoAge);
  assert.match(lt.notes.join(' '), /detection limit/);
  const zero = calculatePhenoAge({ ...WORKED, crp: 0 }, { ...FASTING, crpLowerLimit: 0.15 });
  assert.equal(zero.status, 'ok');
  assert.equal(zero.phenoAge, calculatePhenoAge({ ...WORKED, crp: 0.15 }, FASTING).phenoAge);
  assert.ok(Number.isFinite(calculatePhenoAge({ ...WORKED, crp: 0 }, FASTING).phenoAge));
  // A standard CRP's floor of <5 mg/L is far too high to trust.
  assert.equal(calculatePhenoAge({ ...WORKED, crp: '<5' }, FASTING).confidence, 'low');
});

test('glucose not known to be fasting is calculated but flagged low confidence', () => {
  const unknown = calculatePhenoAge(WORKED);
  assert.equal(unknown.status, 'ok');
  assert.equal(unknown.confidence, 'low');
  assert.match(unknown.notes.join(' '), /fasting/);
  assert.equal(calculatePhenoAge(WORKED, { fasting: false }).confidence, 'low');
  assert.equal(calculatePhenoAge(WORKED, FASTING).confidence, 'standard');
});

test('ages outside 20-84 are not available', () => {
  assert.equal(calculatePhenoAge({ ...WORKED, age: 19 }, FASTING).status, 'unavailable');
  assert.equal(calculatePhenoAge({ ...WORKED, age: 85 }, FASTING).status, 'unavailable');
  assert.equal(calculatePhenoAge({ ...WORKED, age: 20 }, FASTING).status, 'ok');
  assert.equal(calculatePhenoAge({ ...WORKED, age: 84 }, FASTING).status, 'ok');
  assert.match(calculatePhenoAge({ ...WORKED, age: null }, FASTING).message, /date of birth/);
});

test('pregnancy, active cancer treatment and acute illness suppress the result', () => {
  for (const flag of ['pregnant', 'cancerTreatment', 'acuteIllness']) {
    const r = calculatePhenoAge(WORKED, { ...FASTING, flags: { [flag]: true } });
    assert.equal(r.status, 'suppressed', flag);
    assert.equal(r.phenoAge, undefined);
  }
});

test('display rounds to whole or half years only', () => {
  assert.equal(roundToHalf(50.1), 50);
  assert.equal(roundToHalf(50.3), 50.5);
  assert.equal(roundToHalf(50.8), 51);
  assert.equal(formatYears(49.6), '49.5');
  assert.equal(formatYears(49.8), '50');
});

/* ------------------------------------------------------------ simulator */

test('spec simulator examples: glucose 98→90 ≈ 1 year, hs-CRP 1.8→1.0 ≈ 0.5, both (88, 0.8) ≈ 2', () => {
  const base = calculatePhenoAge(WORKED, FASTING);
  const glu = simulateScenario(base, { glucose: 90 });
  assert.equal(roundToHalf(glu.improvement), 1);
  assert.equal(glu.effect, 'about 1 year younger');
  const crp = simulateScenario(base, { crp: 1.0 });
  assert.equal(roundToHalf(crp.improvement), 0.5);
  assert.equal(crp.effect, 'about 0.5 years younger');
  const both = simulateScenario(base, { glucose: 88, crp: 0.8 });
  assert.equal(roundToHalf(both.improvement), 2);
  assert.equal(both.effect, 'about 2 years younger');
});

test('simulator levers at the placeholder targets, plus the combined scenario computed directly', () => {
  assert.equal(SIMULATOR_TARGETS.approved, false);
  const base = calculatePhenoAge(WORKED, FASTING);
  const { levers, combined } = simulateLevers(base);
  assert.deepEqual(levers.map((l) => l.key), ['glucose', 'crp']); // biggest effect first
  const glu = levers.find((l) => l.key === 'glucose');
  assert.equal(glu.label, 'Fasting glucose');
  assert.equal(glu.current, 98);
  assert.equal(glu.target, 85);
  assert.equal(glu.phenoAge, 48.5);
  assert.equal(glu.improvement, 1.6);
  assert.equal(glu.effect, 'about 1.5 years younger');
  // Combined is a fresh run of the formula with both changed, not a sum.
  const direct = simulateScenario(base, { glucose: 85, crp: 1.0 });
  assert.deepEqual(combined, direct);
  assert.equal(combined.improvement, 2.2);
});

test('a lever already at target is not offered; a tiny effect says so', () => {
  const base = calculatePhenoAge({ ...WORKED, glucose: 84, crp: 1.1 }, FASTING);
  const { levers, combined } = simulateLevers(base);
  assert.equal(levers.find((l) => l.key === 'glucose').applicable, false);
  const crp = levers.find((l) => l.key === 'crp');
  assert.equal(crp.applicable, true);
  assert.equal(crp.effect, 'small effect');
  assert.equal(combined, null);
  assert.equal(improvementLabel(0.4), 'small effect');
  assert.equal(improvementLabel(0.5), 'about 0.5 years younger');
});

/* ------------------------------------------------- lab rows and draws */

test('real report names map to the right marker, and lookalikes do not', () => {
  const yes = {
    albumin: ['Albumin', 'ALBUMIN', 'Albumin, Serum'],
    creatinine: ['Creatinine', 'CREATININE', 'Creatinine, Serum'],
    glucose: ['Glucose', 'Glucose, Fasting', 'GLUCOSE', 'Fasting Glucose'],
    crp: ['hs-CRP', 'HS CRP', 'C-Reactive Protein, Cardiac', 'CRP', 'C-Reactive Protein'],
    lymphocytes: ['Lymphocytes', 'Lymphs', 'LYMPHOCYTES', 'Lymphocytes %', 'Lymph%'],
    mcv: ['MCV', 'Mean Corpuscular Volume'],
    rdw: ['RDW', 'RDW-CV', 'Red Cell Distribution Width'],
    alp: ['Alkaline Phosphatase', 'ALKALINE PHOSPHATASE', 'Alk Phos', 'ALP'],
    wbc: ['WBC', 'White Blood Cell Count', 'WHITE BLOOD CELL COUNT', 'Leukocytes'],
  };
  for (const [key, names] of Object.entries(yes)) {
    for (const name of names) assert.equal(markerForRow({ name }), key, name);
  }
  const no = [
    'Albumin/Creatinine Ratio, Urine', 'Microalbumin', 'Prealbumin', 'Albumin/Globulin Ratio',
    'BUN/Creatinine Ratio', 'eGFR', 'Creatinine, Urine', 'Creatine Kinase',
    'Glucose, Urine', 'Estimated Average Glucose', 'Glucose Tolerance 2 Hour', 'Hemoglobin A1c',
    'Lymphs (Absolute)', 'Absolute Lymphocytes', 'RDW-SD', 'MCHC', 'MCH',
    'Leukocyte Esterase', 'WBC, Urine', 'Alkaline Phosphatase, Bone Specific', 'ALT (SGPT)',
  ];
  for (const name of no) assert.equal(markerForRow({ name }), null, name);
});

/** Lab rows as loadLabMarkers returns them. */
const row = (name, value, unit, drawnOn) => ({ name, value: String(value), unit, drawnOn, created_at: `${drawnOn}T12:00:00Z` });
function panel(drawnOn, v = WORKED, glucoseName = 'Glucose, Fasting') {
  return [
    row('Albumin', v.albumin, 'g/dL', drawnOn),
    row('Creatinine', v.creatinine, 'mg/dL', drawnOn),
    row(glucoseName, v.glucose, 'mg/dL', drawnOn),
    row('C-Reactive Protein, Cardiac', v.crp, 'mg/L', drawnOn),
    row('Lymphs', v.lymphocytes, '%', drawnOn),
    row('Lymphs (Absolute)', 1.8, 'x10E3/uL', drawnOn),
    row('MCV', v.mcv, 'fL', drawnOn),
    row('RDW', v.rdw, '%', drawnOn),
    row('Alkaline Phosphatase', v.alp, 'IU/L', drawnOn),
    row('WBC', v.wbc, 'x10E3/uL', drawnOn),
  ];
}
const DOB = '1973-02-10'; // 53 on 2026-06-01

test('age is taken on the draw date, not today', () => {
  assert.equal(ageOnDate(DOB, new Date('2026-06-01T00:00:00')), 53);
  assert.equal(ageOnDate(DOB, new Date('2026-02-09T00:00:00')), 52);
  assert.equal(ageOnDate(DOB, new Date('2026-02-10T00:00:00')), 53);
});

test('the latest complete draw from real lab rows reproduces the worked example', () => {
  const out = bioAgeFromLabs(panel('2026-06-01'), { dob: DOB });
  assert.equal(out.status, 'ok');
  assert.equal(out.latest.phenoAge, 50.1);
  assert.equal(out.latest.age, 53);
  assert.equal(out.latest.confidence, 'standard'); // "Glucose, Fasting" says so
  assert.equal(out.trend, null);
  assert.ok(out.simulator.levers.length === 2);
});

test('markers are never mixed across draws; a newer partial draw does not replace a complete one', () => {
  const older = panel('2025-06-01');
  const newerCmpOnly = panel('2026-09-01').filter((r) => ['Albumin', 'Creatinine', 'Glucose, Fasting', 'Alkaline Phosphatase'].includes(r.name));
  const out = bioAgeFromLabs([...newerCmpOnly, ...older], { dob: DOB });
  assert.equal(out.status, 'ok');
  assert.equal(out.draw.key, '2025-06-01');
  assert.equal(out.latest.age, 52);
  // Split across two draws, neither complete: nothing is calculated.
  const cbcOnly = panel('2025-01-01').filter((r) => !newerCmpOnly.some((n) => n.name === r.name));
  const split = bioAgeFromLabs([...newerCmpOnly, ...cbcOnly], { dob: DOB });
  assert.equal(split.status, 'missing');
  assert.equal(split.latest, undefined);
});

test('the missing message names the test, from the draw closest to complete', () => {
  const noCbc = panel('2026-06-01').filter((r) => !['Lymphs', 'Lymphs (Absolute)', 'MCV', 'RDW', 'WBC'].includes(r.name));
  const out = bioAgeFromLabs(noCbc, { dob: DOB });
  assert.equal(out.status, 'missing');
  assert.equal(out.message, 'Add a CBC with differential to see your biological age.');
  assert.equal(bioAgeFromLabs([], { dob: DOB }).status, 'missing');
  assert.equal(bioAgeFromLabs(panel('2026-06-01'), {}).status, 'unavailable');
});

test('an unlabelled glucose is low confidence; a fasting one is not', () => {
  const out = bioAgeFromLabs(panel('2026-06-01', WORKED, 'Glucose'), { dob: DOB });
  assert.equal(out.latest.confidence, 'low');
});

test('trend compares the gap between the two newest complete draws; under a year is steady', () => {
  const earlier = panel('2024-06-01', { ...WORKED, glucose: 112, crp: 3.5 });
  const later = panel('2026-06-01');
  const out = bioAgeFromLabs([...later, ...earlier], { dob: DOB });
  assert.equal(out.history.length, 2);
  assert.equal(out.trend.sinceKey, '2024-06-01');
  assert.equal(out.trend.direction, 'younger');
  assert.ok(out.trend.change <= -1);
  // Same markers two years apart: PhenoAge rises with age, the gap barely moves.
  const same = bioAgeFromLabs([...panel('2026-06-01'), ...panel('2024-06-01')], { dob: DOB });
  assert.equal(same.trend.direction, 'steady');
  assert.ok(same.history[0].phenoAge > same.history[1].phenoAge);
});

test('rows group by draw date', () => {
  const draws = groupDraws([...panel('2026-06-01'), ...panel('2025-01-15')]);
  assert.deepEqual(draws.map((d) => d.key), ['2026-06-01', '2025-01-15']);
  // The % row wins over the absolute count under the same marker.
  assert.equal(draws[0].rows.lymphocytes.unit, '%');
});

/* --------------------------------------- decisions of Oct 18 2026 (2A, 3A) */

test('more than 10 years younger shows the phrase, not the number', () => {
  const young = { age: 20, albumin: 5.0, creatinine: 0.75, glucose: 78, crp: 0.2, lymphocytes: 40, mcv: 85, rdw: 11.9, alp: 90, wbc: 5.0 };
  const r = calculatePhenoAge(young, FASTING);
  assert.equal(r.status, 'ok');
  assert.ok(r.gap < -10, `gap ${r.gap}`);
  assert.equal(r.capped, true);
  assert.equal(r.headline, 'More than 10 years younger than your age');
  const w = calculatePhenoAge(WORKED, FASTING);
  assert.equal(w.capped, false);
  assert.equal(w.headline, null);
});

test('pregnancy, active cancer treatment or illness at the draw pauses the score', () => {
  for (const flag of ['pregnant', 'cancerTreatment', 'acuteIllness']) {
    const r = calculatePhenoAge(WORKED, { ...FASTING, flags: { [flag]: true } });
    assert.equal(r.status, 'suppressed', flag);
  }
});
