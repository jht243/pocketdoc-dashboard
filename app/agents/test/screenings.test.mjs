// Preventive care fixes from the Oct 18 audit: health-history screenings count on
// the schedule, never-recorded items are "Not on file" rather than "Overdue",
// diabetes screening follows the USPSTF BMI criterion, the score explanation names
// only what is counted, and the four in-app questionnaires score as validated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STATUS, screeningStatus, summarizeSchedule, dbUrgency, nextDueDate,
  parseHeightCm, parseWeightKg, bmiFromIntake, reportsAsianAncestry,
  buildScheduleFromRules, intakeScreeningIds, applyIntakeScreenings,
} from '../../src/lib/screeningLogic.js';
import {
  QUESTIONNAIRES, QUESTIONNAIRE_FOR_ITEM, scoreQuestionnaire, visibleQuestions, cutoffFor, resultMessage,
} from '../../src/lib/screeningQuestionnaires.js';
import { describeScore } from '../../src/lib/scoreExplain.js';

const RULES = JSON.parse(readFileSync(new URL('../../src/lib/uspstfScreeningRules.json', import.meta.url), 'utf8'));
const NOW = new Date(2026, 9, 18); // 18 Oct 2026
const ids = (schedule) => schedule.map((i) => i.id);
const item = (over = {}) => ({ id: 'bp', frequencyMonths: 12, oneTime: false, eligibility: 'met', ...over });

/* ---------------- health history → schedule ---------------- */

test('each health-history screening option maps to its schedule item', () => {
  assert.deepEqual([...intakeScreeningIds(['Colonoscopy or colorectal cancer screening (stool DNA, FIT, sigmoidoscopy)'])], ['colonoscopy']);
  assert.deepEqual([...intakeScreeningIds(['Mammogram'])], ['mammogram']);
  assert.deepEqual([...intakeScreeningIds(['Pap smear / cervical cancer screening'])], ['pap']);
  assert.deepEqual([...intakeScreeningIds(['Bone density scan (DEXA)'])], ['dexa']);
  assert.deepEqual([...intakeScreeningIds(['Low-dose CT lung scan (LDCT)'])], ['lung_ct']);
});

test('options with no USPSTF Grade A/B schedule item map to nothing', () => {
  const none = intakeScreeningIds([
    'PSA (prostate-specific antigen) test', 'Skin cancer / dermatology screening',
    'Cardiac calcium score (CAC)', 'Full-body MRI', 'Genetic / genomic testing (23andMe, Ancestry, clinical WGS)',
    'Pulmonary function test (spirometry)', 'None of the above',
  ]);
  assert.equal(none.size, 0);
});

test('every mapped option in the intake actually exists in intakeContent.js', () => {
  // Guards the keyword match against a wording change in the questionnaire.
  const src = readFileSync(new URL('../../src/lib/intakeContent.js', import.meta.url), 'utf8');
  for (const label of ['Colonoscopy or colorectal cancer screening', '"Mammogram"', 'Pap smear / cervical cancer screening', 'Bone density scan (DEXA)', 'Low-dose CT lung scan (LDCT)']) {
    assert.ok(src.includes(label), `intake option missing: ${label}`);
  }
});

const schedule50f = buildScheduleFromRules(RULES, { age: 50, sex: 'female', bmi: 27 });

test('ticking colonoscopy in the health history marks colorectal screening done, without a date', () => {
  const r = applyIntakeScreenings({
    schedule: schedule50f, completedItems: {},
    screeningsCompleted: ['Colonoscopy or colorectal cancer screening (stool DNA, FIT, sigmoidoscopy)', 'Mammogram'],
  });
  assert.equal(r.completedItems.colonoscopy, true);
  assert.equal(r.completedItems.mammogram, true);
  assert.equal(r.changed, true);
  assert.deepEqual(r.applied, ['colonoscopy', 'mammogram']);
  assert.equal(screeningStatus(schedule50f.find((i) => i.id === 'colonoscopy'), r.completedItems.colonoscopy, NOW), STATUS.CURRENT);
});

test('a date already recorded on Preventive care is kept, not overwritten with true', () => {
  const r = applyIntakeScreenings({ schedule: schedule50f, completedItems: { mammogram: '2025-03' }, screeningsCompleted: ['Mammogram'] });
  assert.equal(r.completedItems.mammogram, '2025-03');
  assert.equal(r.changed, false);
  assert.deepEqual(r.applied, ['mammogram']);
});

test('unticking in the health history never un-marks the schedule', () => {
  const r = applyIntakeScreenings({ schedule: schedule50f, completedItems: { mammogram: true, colonoscopy: '2020-01' }, screeningsCompleted: [], applied: ['mammogram'] });
  assert.equal(r.completedItems.mammogram, true);
  assert.equal(r.completedItems.colonoscopy, '2020-01');
  assert.deepEqual(r.applied, []);
  assert.equal(r.appliedChanged, true);
});

test('an item the member cleared on Preventive care is not re-marked by an old answer', () => {
  const r = applyIntakeScreenings({ schedule: schedule50f, completedItems: {}, screeningsCompleted: ['Mammogram'], applied: ['mammogram'] });
  assert.equal(r.completedItems.mammogram, undefined);
  assert.equal(r.changed, false);
  assert.equal(r.appliedChanged, false);
});

test('a screening not yet on the schedule waits until it is', () => {
  const at44 = buildScheduleFromRules(RULES, { age: 44, sex: 'male' });
  const colo = ['Colonoscopy or colorectal cancer screening (stool DNA, FIT, sigmoidoscopy)'];
  const before = applyIntakeScreenings({ schedule: at44, completedItems: {}, screeningsCompleted: colo });
  assert.equal(before.completedItems.colonoscopy, undefined);
  assert.deepEqual(before.applied, []);
  const at45 = buildScheduleFromRules(RULES, { age: 45, sex: 'male' });
  const after = applyIntakeScreenings({ schedule: at45, completedItems: {}, screeningsCompleted: colo, applied: before.applied });
  assert.equal(after.completedItems.colonoscopy, true);
});

/* ---------------- status ---------------- */

test('a never-recorded screening is Not on file, never Overdue', () => {
  assert.equal(screeningStatus(item(), undefined, NOW), STATUS.NOT_ON_FILE);
  assert.equal(screeningStatus(item(), false, NOW), STATUS.NOT_ON_FILE);
  assert.equal(screeningStatus(item({ eligibility: 'check' }), undefined, NOW), STATUS.CHECK_ELIGIBILITY);
});

test('Overdue only when the recorded date is past the interval', () => {
  assert.equal(screeningStatus(item(), '2026-06', NOW), STATUS.CURRENT);
  assert.equal(screeningStatus(item(), '2026-01', NOW), STATUS.CURRENT);    // due in 3 months
  assert.equal(screeningStatus(item(), '2025-12', NOW), STATUS.DUE_SOON);   // due in 2 months
  assert.equal(screeningStatus(item(), '2025-10', NOW), STATUS.DUE_SOON);   // due this month
  assert.equal(screeningStatus(item(), '2025-11', NOW), STATUS.DUE_SOON);   // due next month
  assert.equal(screeningStatus(item(), '2025-09', NOW), STATUS.OVERDUE);    // due last month
  assert.equal(screeningStatus(item({ frequencyMonths: 120 }), '2014-06', NOW), STATUS.OVERDUE);
});

test('done without a month, and one-time screens, stay up to date', () => {
  assert.equal(screeningStatus(item(), true, NOW), STATUS.CURRENT);
  assert.equal(screeningStatus(item({ oneTime: true, frequencyMonths: null }), '1999-01', NOW), STATUS.CURRENT);
});

test('a brand-new member has zero overdue items', () => {
  const s = buildScheduleFromRules(RULES, { age: 50, sex: 'male' });
  const counts = summarizeSchedule(s, {}, NOW);
  assert.equal(counts.overdue, 0);
  assert.equal(counts.recorded, 0);
  assert.equal(counts.not_on_file + counts.check_eligibility, s.length);
});

test('next due date and the database urgency respect the check constraint', () => {
  assert.equal(nextDueDate(item(), '2025-11'), '2026-11-01');
  assert.equal(nextDueDate(item({ frequencyMonths: 120 }), '2016-03'), '2026-03-01');
  assert.equal(nextDueDate(item(), true), null);
  assert.equal(dbUrgency(item(), undefined, NOW), null);                // not on file
  assert.equal(dbUrgency(item({ eligibility: 'check' }), undefined, NOW), null);
  assert.equal(dbUrgency(item(), '2014-01', NOW), 'done');
  for (const v of [undefined, true, '2014-01', '2026-01']) {
    assert.ok([null, 'overdue', 'due_soon', 'upcoming', 'done'].includes(dbUrgency(item(), v, NOW)));
  }
});

/* ---------------- BMI eligibility for diabetes screening ---------------- */

test('height and weight parse from the intake shapes', () => {
  assert.equal(Math.round(parseHeightCm({ unit: 'imperial', feet: '5', inches: '10' })), 178);
  assert.equal(parseHeightCm({ unit: 'metric', cm: '170' }), 170);
  assert.equal(Math.round(parseHeightCm("5'10")), 178);
  assert.equal(Math.round(parseHeightCm('5 ft 4 in')), 163);
  assert.equal(parseHeightCm('178 cm'), 178);
  assert.equal(parseHeightCm({ unit: 'imperial', feet: '', inches: '' }), null);
  assert.equal(parseHeightCm('tall'), null);
  assert.equal(Math.round(parseWeightKg('175 lbs')), 79);
  assert.equal(Math.round(parseWeightKg('175')), 79);
  assert.equal(parseWeightKg('80 kg'), 80);
  assert.equal(parseWeightKg(''), null);
  assert.equal(parseWeightKg('a lot'), null);
});

test('BMI from the intake', () => {
  assert.equal(bmiFromIntake({ height: { unit: 'metric', cm: '180' }, weight: '81 kg' }), 25);
  assert.equal(bmiFromIntake({ height: { unit: 'metric', cm: '180' } }), null);
  assert.equal(bmiFromIntake({}), null);
});

test('diabetes screening is listed at BMI 25+, dropped below it', () => {
  assert.ok(ids(buildScheduleFromRules(RULES, { age: 40, sex: 'male', bmi: 25 })).includes('glucose'));
  assert.ok(ids(buildScheduleFromRules(RULES, { age: 40, sex: 'male', bmi: 31 })).includes('glucose'));
  assert.ok(!ids(buildScheduleFromRules(RULES, { age: 40, sex: 'male', bmi: 24.9 })).includes('glucose'));
});

test('Asian ancestry lowers the threshold to 23', () => {
  assert.equal(reportsAsianAncestry({ raceEthnicity: ['Asian / Pacific Islander'] }), true);
  assert.equal(reportsAsianAncestry({ raceEthnicity: ['White / Caucasian'] }), false);
  assert.ok(ids(buildScheduleFromRules(RULES, { age: 40, sex: 'female', bmi: 23.5, asianAncestry: true })).includes('glucose'));
  assert.ok(!ids(buildScheduleFromRules(RULES, { age: 40, sex: 'female', bmi: 23.5, asianAncestry: false })).includes('glucose'));
  assert.ok(!ids(buildScheduleFromRules(RULES, { age: 40, sex: 'female', bmi: 22.9, asianAncestry: true })).includes('glucose'));
});

test('unknown height/weight lists it as Check eligibility, not a to-do', () => {
  const s = buildScheduleFromRules(RULES, { age: 40, sex: 'male' });
  const glucose = s.find((i) => i.id === 'glucose');
  assert.equal(glucose.eligibility, 'check');
  assert.match(glucose.note, /^Check eligibility: for adults 35–70 with overweight or obesity/);
  assert.equal(screeningStatus(glucose, undefined, NOW), STATUS.CHECK_ELIGIBILITY);
});

test('outside 35–70 it is not listed whatever the BMI', () => {
  assert.ok(!ids(buildScheduleFromRules(RULES, { age: 34, sex: 'male', bmi: 35 })).includes('glucose'));
  assert.ok(!ids(buildScheduleFromRules(RULES, { age: 71, sex: 'male', bmi: 35 })).includes('glucose'));
});

/* ---------------- score explanation ---------------- */

test('the explanation names only the parts counted for this member', () => {
  const none = describeScore({ hasSchedule: true });
  assert.equal(none.scored, false);
  assert.equal(none.startHint, "Mark the screenings you've had");
  assert.doesNotMatch(none.sentence, /wearable/i);

  const prevOnly = describeScore({ hasSchedule: true, preventiveCounted: true });
  assert.deepEqual(prevOnly.counted, ['preventive']);
  assert.doesNotMatch(prevOnly.sentence, /wearable/i);
  assert.match(prevOnly.sentence, /Bloodwork isn't scored yet/);

  const withRing = describeScore({ hasSchedule: true, preventiveCounted: true, wearableConnected: true });
  assert.match(withRing.sentence, /wearable readings/);

  const all = describeScore({ hasSchedule: true, preventiveCounted: true, wearableConnected: true, bloodworkScored: true });
  assert.deepEqual(all.counted, ['preventive', 'wearable', 'bloodwork']);
  assert.doesNotMatch(all.sentence, /isn't scored yet/);
  assert.equal(all.footnote, null);
});

/* ---------------- questionnaires ---------------- */

test('each questionnaire runs the matching schedule item', () => {
  assert.deepEqual(QUESTIONNAIRE_FOR_ITEM, { depression: 'phq2', anxiety: 'gad2', alcohol: 'auditc', drug_use: 'single_drug' });
  for (const id of Object.keys(QUESTIONNAIRE_FOR_ITEM)) assert.ok(RULES.some((r) => r.id === id), id);
});

test('validated wording is intact', () => {
  assert.deepEqual(QUESTIONNAIRES.phq2.questions.map((q) => q.text), ['Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless']);
  assert.deepEqual(QUESTIONNAIRES.gad2.questions.map((q) => q.text), ['Feeling nervous, anxious or on edge', 'Not being able to stop or control worrying']);
  assert.equal(QUESTIONNAIRES.single_drug.questions[0].text,
    'How many times in the past year have you used an illegal drug or used a prescription medication for non-medical reasons?');
  assert.deepEqual(QUESTIONNAIRES.auditc.questions.map((q) => q.text), [
    'How often do you have a drink containing alcohol?',
    'How many standard drinks containing alcohol do you have on a typical day?',
    'How often do you have six or more drinks on one occasion?',
  ]);
});

test('PHQ-2 and GAD-2: positive at 3 or more', () => {
  assert.deepEqual(scoreQuestionnaire('phq2', { interest: 1, down: 1 }), { complete: true, score: 2, positive: false, cutoff: 3 });
  assert.equal(scoreQuestionnaire('phq2', { interest: 2, down: 1 }).positive, true);
  assert.equal(scoreQuestionnaire('gad2', { nervous: 3, worrying: 3 }).score, 6);
  assert.equal(scoreQuestionnaire('gad2', { nervous: 0, worrying: 2 }).positive, false);
  assert.equal(scoreQuestionnaire('phq2', { interest: 3 }).complete, false);
  assert.equal(scoreQuestionnaire('phq2', { interest: 3, down: 9 }).complete, false);
});

test('AUDIT-C uses sex-specific cut-offs', () => {
  const three = { frequency: 2, typical: 0, sixOrMore: 1 };
  assert.equal(scoreQuestionnaire('auditc', three, { sex: 'male' }).positive, false);
  assert.equal(scoreQuestionnaire('auditc', three, { sex: 'female' }).positive, true);
  assert.equal(scoreQuestionnaire('auditc', { frequency: 2, typical: 1, sixOrMore: 1 }, { sex: 'male' }).positive, true);
  assert.equal(cutoffFor('auditc', { sex: 'male' }), 4);
  assert.equal(cutoffFor('auditc', { sex: 'female' }), 3);
  assert.equal(cutoffFor('auditc', {}), 3); // unknown → the more sensitive cut-off
});

test('AUDIT-C: a non-drinker answers one question and scores 0', () => {
  assert.deepEqual(visibleQuestions('auditc', { frequency: 0 }).map((q) => q.id), ['frequency']);
  assert.deepEqual(scoreQuestionnaire('auditc', { frequency: 0 }, { sex: 'female' }), { complete: true, score: 0, positive: false, cutoff: 3 });
});

test('single-question drug screen: any use in the past year is positive', () => {
  assert.equal(scoreQuestionnaire('single_drug', { times: 0 }).positive, false);
  assert.equal(scoreQuestionnaire('single_drug', { times: 1 }).positive, true);
  assert.equal(scoreQuestionnaire('single_drug', { times: 6 }).positive, true);
});

test('only a positive PHQ-2 shows the 988 line, and no result reads as a diagnosis', () => {
  assert.equal(resultMessage('phq2', scoreQuestionnaire('phq2', { interest: 2, down: 2 })).show988, true);
  assert.equal(resultMessage('phq2', scoreQuestionnaire('phq2', { interest: 0, down: 0 })).show988, false);
  assert.equal(resultMessage('gad2', scoreQuestionnaire('gad2', { nervous: 3, worrying: 3 })).show988, false);
  for (const def of Object.values(QUESTIONNAIRES)) {
    for (const text of [def.positiveMessage, def.negativeMessage]) {
      assert.doesNotMatch(text, /you have (depression|anxiety|an? (alcohol|drug|substance))|diagnos(is|ed) with|disorder/i);
    }
  }
});

/* ---------------- questionnaire results reach the AI ---------------- */

test('completed questionnaires are written into the AI context', async () => {
  const { questionnaireLines } = await import('../../src/lib/screeningQuestionnaires.js');
  const rows = [
    { instrument: 'phq2', answers: { interest: 2, down: 2 }, score: 4, positive: true, cutoff: 3, completed_on: '2026-10-18' },
    { instrument: 'single_drug', answers: { times: 0 }, score: 0, positive: false, cutoff: 1, completed_on: '2026-10-17' },
  ];
  const text = questionnaireLines(rows);
  assert.match(text, /2026-10-18 PHQ-2 \(depression screen; the member knows it as the "Mood check"\): score 4 of 6, POSITIVE screen \(cut-off 3\)/);
  assert.match(text, /"Feeling down, depressed, or hopeless": More than half the days/);
  assert.match(text, /drug-use screen; the member knows it as the "Drug use check"\): negative screen \(cut-off 1\)\. Answers: .*: Never\./);
  assert.doesNotMatch(text, /score 0/);
  // healthContext.js carries it as its own keyed section, the key the agents read.
  const ctx = readFileSync(new URL('../../src/lib/healthContext.js', import.meta.url), 'utf8');
  assert.match(ctx, /key: "questionnaires"[^\n]*questionnaireLines\(healthData\?\.questionnaires/);
});

test('every specialist but bloodwork is handed the questionnaire results', async () => {
  const { TEAM } = await import('../lib/team.mjs');
  for (const [id, a] of Object.entries(TEAM)) {
    assert.equal(a.facts.includes('questionnaires'), id !== 'bloodwork', id);
  }
});
