// Height, weight and waist from the Oct 21 2026 call: weight and waist are saved as a
// number plus unit, relative fat mass and waist-to-height are what members see, and
// BMI is still worked out in the background for eligibility rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWeightKg, parseWaistCm, bmiFromIntake } from '../../src/lib/screeningLogic.js';
import { bodyMetrics, relativeFatMass, hasHeightAndWeight } from '../../src/lib/bodyMetrics.js';

test('weight saved as number + unit', () => {
  assert.equal(Math.round(parseWeightKg({ unit: 'lb', value: '175' })), 79);
  assert.equal(parseWeightKg({ unit: 'kg', value: '80' }), 80);
  assert.equal(parseWeightKg({ unit: 'lb', value: '' }), null);
  // The old free-text answers still read.
  assert.equal(parseWeightKg('80 kg'), 80);
});

test('waist in inches or cm; a dress size is not a waist', () => {
  assert.equal(parseWaistCm({ unit: 'cm', value: '86' }), 86);
  assert.equal(Math.round(parseWaistCm({ unit: 'in', value: '34' })), 86);
  assert.equal(parseWaistCm({ unit: 'in', value: '8' }), null);
  assert.equal(parseWaistCm(null), null);
});

test('relative fat mass (Woolcott & Bergman 2018)', () => {
  // 178 cm, 86 cm waist: 64 − 20 × 178/86 = 22.6 (male), +12 female.
  assert.equal(relativeFatMass(178, 86, 'male'), 22.6);
  assert.equal(relativeFatMass(178, 86, 'female'), 34.6);
  assert.equal(relativeFatMass(178, 86, ''), null);
  assert.equal(relativeFatMass(178, null, 'male'), null);
});

test('bodyMetrics: every measure, null where an input is missing', () => {
  const intake = { height: { unit: 'metric', cm: '180' }, weight: { unit: 'kg', value: '81' }, waist: { unit: 'cm', value: '90' } };
  const m = bodyMetrics(intake, 'male');
  assert.equal(m.bmi, 25);
  assert.equal(m.bmi, bmiFromIntake(intake));
  assert.equal(m.waistToHeight, 0.5);
  assert.equal(m.rfm, 24);
  const noWaist = bodyMetrics({ ...intake, waist: undefined }, 'male');
  assert.equal(noWaist.rfm, null);
  assert.equal(noWaist.waistToHeight, null);
  assert.equal(noWaist.bmi, 25);
});

test('onboarding needs both height and weight', () => {
  assert.equal(hasHeightAndWeight({ height: { unit: 'imperial', feet: '5', inches: '10' }, weight: { unit: 'lb', value: '170' } }), true);
  assert.equal(hasHeightAndWeight({ height: { unit: 'imperial', feet: '5', inches: '10' } }), false);
  assert.equal(hasHeightAndWeight({}), false);
});
