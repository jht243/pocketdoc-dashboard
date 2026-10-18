// The Biology screen's results display (Adam's Oct 14 build spec): per-marker status
// against the lab range and the Thumbprint target, the six-system scorecard's
// rating rules, and the bundled target seed agreeing with the migration. Targets
// are placeholders until the medical director approves them; asserted here as written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  markerStatus, statusLabel, targetPosition, labPosition, rateSystem, rateSystems, SYSTEMS, RATING_LABELS,
} from '../../src/lib/scorecard.js';
import {
  MARKER_TARGETS, markerIdFor, targetFor, formatTarget, latestVersions, ageFromDob, canonUnit,
} from '../../src/lib/markerTargets.js';
import { hasFunctionalConcern, violatesForbiddenOutput } from '../../src/lib/clinicalRules.js';

const sys = (id) => SYSTEMS.find((s) => s.id === id);
const rating = (id, statuses) => rateSystem(sys(id), statuses).rating;

/* ---------------- per-marker status ---------------- */

test('status: red only outside the lab range; outside target alone is its own status', () => {
  const ldl = { direction: 'lower_better', target_low: null, target_high: 100 };
  assert.equal(markerStatus({ value: '104', range: '0-99', target: ldl }), 'outside_lab');
  assert.equal(markerStatus({ value: '104', range: '0-129', target: ldl }), 'outside_target');
  assert.equal(markerStatus({ value: '88', range: '0-129', target: ldl }), 'within_target');
  assert.equal(markerStatus({ value: '88', range: '0-129', target: null }), 'within_lab');
  assert.equal(markerStatus({ value: '88', range: '', target: null }), 'unknown');
  assert.equal(markerStatus({ value: 'see note', range: '0-129', target: ldl }), 'unknown');
  assert.equal(statusLabel('outside_target'), 'Outside target, within lab range');
  assert.equal(statusLabel('outside_target', { hasLabRange: false }), 'Outside target');
});

test('target bounds: lower_better is strictly under, higher_better is at or above, range is inclusive', () => {
  const a1c = { direction: 'lower_better', target_high: 5.7 };
  assert.equal(targetPosition('5.6', a1c), 'within');
  assert.equal(targetPosition('5.7', a1c), 'outside');
  const hdl = { direction: 'higher_better', target_low: 40 };
  assert.equal(targetPosition('40', hdl), 'within');
  assert.equal(targetPosition('39', hdl), 'outside');
  const glucose = { direction: 'range', target_low: 70, target_high: 99 };
  assert.equal(targetPosition('70', glucose), 'within');
  assert.equal(targetPosition('99', glucose), 'within');
  assert.equal(targetPosition('100', glucose), 'outside');
  // Reported limits read as just past the printed number.
  assert.equal(targetPosition('<1.0', { direction: 'lower_better', target_high: 1.0 }), 'within');
});

test('lab position reads the range exactly as printed: spans, "<x", ">x"', () => {
  assert.equal(labPosition('1.2', '0.57-1.00'), 'outside');
  assert.equal(labPosition('0.9', '0.57 – 1.00'), 'within');
  assert.equal(labPosition('45', '>39'), 'within');
  assert.equal(labPosition('1.2', '<1.10'), 'outside');
  assert.equal(labPosition('1.0', 'Negative'), 'unknown');
});

/* ---------------- system ratings ---------------- */

test('needs attention: any marker outside the lab range, even when the system is thinly covered', () => {
  assert.equal(rating('metabolic', { FASTING_GLUCOSE: 'outside_lab' }), 'needs_attention');
  assert.equal(rating('organ', { ALT: 'outside_lab', ALBUMIN: 'within_target', CREATININE: 'within_target' }), 'needs_attention');
});

test('needs attention: half or more of the on-file markers outside target', () => {
  assert.equal(rating('metabolic', { FASTING_GLUCOSE: 'outside_target', HBA1C: 'within_target' }), 'needs_attention');
  assert.equal(rating('blood', { RDW: 'outside_target', MCV: 'outside_target', HEMOGLOBIN: 'within_target' }), 'needs_attention');
  assert.equal(rating('blood', { RDW: 'outside_target', MCV: 'within_target', HEMOGLOBIN: 'within_target' }), 'fair');
});

test('strong: every available marker within target', () => {
  assert.equal(rating('inflammation', { HS_CRP: 'within_target', WBC: 'within_target' }), 'strong');
  assert.equal(rating('heart', { LDL_C: 'within_target', HDL_C: 'within_target' }), 'strong');
  // A marker with no target to judge it by clears the bar on the lab range alone.
  assert.equal(rating('heart', { LDL_C: 'within_target', HDL_C: 'within_target', BLOOD_PRESSURE: 'within_lab' }), 'strong');
});

test('fair: everything else, including a marker with nothing to compare against', () => {
  assert.equal(rating('organ', { ALBUMIN: 'within_target', CREATININE: 'within_target', EGFR: 'within_target', ALT: 'outside_target' }), 'fair');
  assert.equal(rating('nutrients', { VITAMIN_D_25OH: 'within_target', FERRITIN: 'unknown' }), 'fair');
});

test('not enough data: fewer than half the system markers on file', () => {
  assert.equal(rating('metabolic', { FASTING_GLUCOSE: 'within_target' }), 'not_enough_data');
  assert.equal(rating('organ', { ALBUMIN: 'within_target', ALT: 'within_target' }), 'not_enough_data');
  assert.equal(rating('organ', { ALBUMIN: 'within_target', ALT: 'within_target', AST: 'within_target' }), 'strong');
  assert.equal(rating('inflammation', {}), 'not_enough_data');
  assert.equal(rating('inflammation', { WBC: 'within_target' }), 'strong'); // 1 of 2 is half
});

test('the scorecard is six named systems in words only: no score, percentage or weighting', () => {
  const all = rateSystems({});
  assert.deepEqual(all.map((s) => s.name), ['Metabolic', 'Inflammation', 'Organ function', 'Blood', 'Nutrients', 'Heart and lipids']);
  assert.deepEqual(Object.values(RATING_LABELS).sort(), ['Fair', 'Needs attention', 'Not enough data', 'Strong']);
  for (const s of all) {
    assert.ok(RATING_LABELS[s.rating]);
    assert.equal('score' in s || 'percent' in s || 'weight' in s, false);
  }
});

/* ---------------- the target seed ---------------- */

test('the seed covers the guideline-backed markers, every row pending approval', () => {
  const ids = new Set(MARKER_TARGETS.map((r) => r.marker_id));
  assert.equal(ids.size, 21);
  for (const id of ['LDL_C', 'HDL_C', 'TRIGLYCERIDES', 'APOB', 'LPA', 'TOTAL_CHOLESTEROL', 'FASTING_GLUCOSE', 'HBA1C',
    'HS_CRP', 'ALT', 'AST', 'ALP', 'CREATININE', 'EGFR', 'FERRITIN', 'VITAMIN_D_25OH',
    'B12', 'TSH', 'FREE_T4', 'HEMOGLOBIN', 'MCV']) assert.ok(ids.has(id), id);
  // Guideline-based only (Oct 19 2026): these had no guideline target, so the lab
  // range on the report stands alone.
  for (const id of ['FASTING_INSULIN', 'WBC', 'RDW', 'ALBUMIN']) assert.ok(!ids.has(id), id);
  for (const r of MARKER_TARGETS) {
    assert.equal(r.approved_by, 'pending', r.marker_id);
    assert.ok(['Strong', 'Moderate', 'Emerging'].includes(r.evidence_level), r.marker_id);
    assert.ok(['lower_better', 'higher_better', 'range'].includes(r.direction), r.marker_id);
    assert.ok(r.target_low != null || r.target_high != null, r.marker_id);
    assert.ok(r.rationale && r.source, r.marker_id);
  }
});

test('vitamin D is Emerging and states the 2024 Endocrine Society position', () => {
  const rows = MARKER_TARGETS.filter((r) => r.marker_id === 'VITAMIN_D_25OH');
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.evidence_level, 'Emerging');
    assert.match(r.rationale, /2024 Endocrine Society guideline/);
    assert.match(r.rationale, /against routine/);
  }
  assert.match(rows.find((r) => r.applies_to.age_min == null).rationale, /healthy adults under 75/);
});

test('the bundled seed and the migration agree row for row', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261018_marker_targets.sql', import.meta.url), 'utf8');
  const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
  const n = (x) => (x == null ? 'null' : String(x));
  // The seed migration still holds the four rows a later migration removed
  // (20261019_guideline_targets_only.sql); every bundled row must be in it.
  const removed = ['FASTING_INSULIN', 'WBC', 'RDW', 'ALBUMIN'];
  const rowsInSql = (sql.match(/^ {2}\('([A-Z0-9_]+)', /gm) || []).filter((r) => !removed.some((id) => r.includes(`'${id}'`)));
  assert.equal(rowsInSql.length, MARKER_TARGETS.length);
  const later = readFileSync(new URL('../../supabase/migrations/20261019_guideline_targets_only.sql', import.meta.url), 'utf8');
  for (const id of removed) assert.match(later, new RegExp(`'${id}'`));
  for (const r of MARKER_TARGETS) {
    const head = `(${q(r.marker_id)}, ${q(r.unit)}, ${q(JSON.stringify(r.applies_to))}::jsonb, ${n(r.target_low)}, ${n(r.target_high)}, ${q(r.direction)},`;
    assert.ok(sql.includes(head), `missing in migration: ${head}`);
    assert.ok(sql.includes(q(r.rationale)), `rationale differs: ${r.marker_id}`);
    assert.ok(sql.includes(`${q(r.evidence_level)}, ${q(r.source)}, ${q(r.approved_by)}`), `labels differ: ${r.marker_id}`);
  }
  assert.match(sql, /grant select on ghai\.marker_targets to authenticated/);
  assert.doesNotMatch(sql, /grant (insert|update|delete)/i);
});

test('both modules stay import-free so this runner can load them', () => {
  for (const f of ['scorecard.js', 'markerTargets.js']) {
    const src = readFileSync(new URL(`../../src/lib/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /^\s*import\s/m, f);
  }
});

test('no target rationale would trip the safety net (it is member-facing copy)', () => {
  for (const r of MARKER_TARGETS) assert.equal(violatesForbiddenOutput(r.rationale), null, `${r.marker_id}: ${r.rationale}`);
});

test('the safety net treats a reading outside its Thumbprint target as a reason "normal" is forbidden', () => {
  const ldl = (value) => ({ labs: [{ name: 'LDL Cholesterol', value, unit: 'mg/dL', range: '0-129' }] });
  assert.equal(hasFunctionalConcern(ldl('112')), true);
  assert.equal(hasFunctionalConcern(ldl('88')), false);
  // Outside the lab range is not this check's job; urgency and lanes handle it.
  assert.equal(hasFunctionalConcern({ labs: [{ name: 'LDL Cholesterol', value: '150', unit: 'mg/dL', range: '0-129' }] }), false);
  assert.match(violatesForbiddenOutput('Your results are normal.', { hasFunctionalConcern: true }), /outside its target/);
});

/* ---------------- matching names, units, the member ---------------- */

test('lab names map to marker ids without catching their neighbours', () => {
  const cases = {
    'LDL Chol Calc (NIH)': 'LDL_C', 'LDL-P': null, 'HDL Cholesterol': 'HDL_C', 'Non-HDL Cholesterol': null,
    'Cholesterol, Total': 'TOTAL_CHOLESTEROL', 'VLDL Cholesterol Cal': null, 'Hemoglobin A1c': 'HBA1C', 'Hemoglobin': 'HEMOGLOBIN',
    'MCHC': null, 'Glucose': 'FASTING_GLUCOSE', 'Insulin': 'FASTING_INSULIN', 'C-Reactive Protein, Cardiac': 'HS_CRP',
    'ALT (SGPT)': 'ALT', 'AST (SGOT)': 'AST', 'Alkaline Phosphatase': 'ALP', 'eGFR': 'EGFR', 'Creatinine': 'CREATININE',
    'Vitamin D, 25-Hydroxy': 'VITAMIN_D_25OH', 'Vitamin B12': 'B12', 'TSH': 'TSH', 'T4, Free (Direct)': 'FREE_T4',
    'RDW': 'RDW', 'MCV': 'MCV', 'WBC': 'WBC', 'Ferritin': 'FERRITIN', 'Apolipoprotein B': 'APOB', 'Lipoprotein (a)': 'LPA',
  };
  for (const [name, id] of Object.entries(cases)) assert.equal(markerIdFor(name), id, name);
});

test('targets personalise by sex and age, and never apply in a different unit', () => {
  const t = (markerId, unit, sex, age) => targetFor(MARKER_TARGETS, { markerId, unit, sex, age });
  assert.equal(t('HDL_C', 'mg/dL', 'male', 40).target_low, 40);
  assert.equal(t('HDL_C', 'mg/dL', 'Female', 40).target_low, 50);
  assert.equal(t('HDL_C', 'mg/dL', null, 40), null); // sex unknown: lab range only
  assert.equal(t('TSH', 'uIU/mL', 'female', 45).target_high, 4.5);
  assert.equal(t('TSH', 'mIU/L', 'female', 78).target_high, 6.0);
  assert.equal(t('TSH', 'mIU/L', 'female', null).target_high, 4.5);
  assert.equal(t('VITAMIN_D_25OH', 'ng/mL', 'male', 80).applies_to.age_min, 75);
  assert.equal(t('LPA', 'nmol/L', 'male', 50).target_high, 125);
  assert.equal(t('LPA', 'mg/dL', 'male', 50).target_high, 50);
  assert.equal(t('LDL_C', 'mmol/L', 'male', 50), null);
  assert.equal(t('WBC', 'K/uL', 'male', 50), null); // no guideline target: lab range only
  assert.equal(canonUnit('x10E3/uL'), canonUnit('x10^9/L'));
});

test('target wording and versioning', () => {
  assert.equal(formatTarget({ direction: 'lower_better', target_high: 100, unit: 'mg/dL' }), 'Under 100 mg/dL');
  assert.equal(formatTarget({ direction: 'higher_better', target_low: 60, unit: 'mL/min/1.73m2' }), '60 mL/min/1.73m2 or above');
  assert.equal(formatTarget({ direction: 'range', target_low: 70, target_high: 99, unit: 'mg/dL' }), '70–99 mg/dL');
  const rows = [{ marker_id: 'LDL_C', version: 1 }, { marker_id: 'LDL_C', version: 2 }, { marker_id: 'HBA1C', version: 1 }];
  assert.deepEqual(latestVersions(rows).map((r) => `${r.marker_id}@${r.version}`), ['LDL_C@2', 'HBA1C@1']);
  assert.equal(ageFromDob('1980-06-15', new Date('2026-06-14T12:00:00')), 45);
  assert.equal(ageFromDob('1980-06-15', new Date('2026-06-15T12:00:00')), 46);
});
