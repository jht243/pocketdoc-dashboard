// Provider follow-ups (src/lib/followUps.js): which lane cards open one, that a
// marker never gets two, and when the morning check-in asks (30 days, then 60 with
// "It's still waiting", and never again once answered or closed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, followUpsFromLanes, followUpStage, dueFollowUp, followUpQuestion, followUpAnswer, markerPhrase,
} from '../../src/lib/followUps.js';
import { lanesFor } from '../lib/escalation.mjs';

const TODAY = '2026-10-18';

const card = (marker, lane, extra = {}) => ({ marker, name: marker[0].toUpperCase() + marker.slice(1), lane, level: lane === 'provider' ? 'flag' : null, why: 'Above the matrix threshold.', shown: '1 unit', date: 'Sep 17, 2026', ...extra });

test('days are calendar days, across months and years', () => {
  assert.equal(addDays('2026-10-18', 30), '2026-11-17');
  assert.equal(addDays('2026-12-15', 60), '2027-02-13');
  assert.equal(addDays('2026-02-27', 2), '2026-03-01');
});

test('only provider-lane markers open a follow-up, one per marker, due at 30 and 60', () => {
  const rows = followUpsFromLanes([card('ferritin', 'provider'), card('hdl', 'self'), card('alt', null), card('ferritin', 'provider')], [], TODAY);
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { marker: rows[0].marker, status: rows[0].status, due_30: rows[0].due_30, due_60: rows[0].due_60, reading_date: rows[0].reading_date },
    { marker: 'ferritin', status: 'open', due_30: '2026-11-17', due_60: '2026-12-17', reading_date: 'Sep 17, 2026' },
  );
  assert.equal(rows[0].lane_reason, 'Above the matrix threshold.');
});

test('the lane cards from the real escalation code open follow-ups for the provider lane only', () => {
  const lanes = lanesFor([
    { name: 'Lp(a)', value: 180, unit: 'nmol/L', date: 'Sep 17, 2026', drawnOn: '2026-09-17' },
    { name: 'HDL Cholesterol', value: 60, unit: 'mg/dL', date: 'Sep 17, 2026', drawnOn: '2026-09-17' },
  ], { sex: 'male' });
  const rows = followUpsFromLanes(lanes, [], TODAY);
  assert.deepEqual(rows.map((r) => r.marker), ['lpa']);
  assert.equal(rows[0].marker_name, 'Lp(a)');
});

test('no duplicate: an open one blocks a second, a closed one blocks the same reading', () => {
  const lanes = [card('ferritin', 'provider')];
  assert.equal(followUpsFromLanes(lanes, [{ marker: 'ferritin', status: 'open', reading_date: 'Jan 1, 2026' }], TODAY).length, 0);
  for (const status of ['discussed', 'scheduled', 'dismissed']) {
    assert.equal(followUpsFromLanes(lanes, [{ marker: 'ferritin', status, reading_date: 'Sep 17, 2026' }], TODAY).length, 0, status);
  }
  // A newer draw still in the provider lane, after the old loop was closed, is a new loop.
  assert.equal(followUpsFromLanes(lanes, [{ marker: 'ferritin', status: 'discussed', reading_date: 'Mar 2, 2026' }], TODAY).length, 1);
});

test('due logic: nothing before 30 days, once at 30, once at 60, then quiet', () => {
  const [row] = followUpsFromLanes([card('ferritin', 'provider')], [], TODAY);
  const item = { id: 'f1', ...row };
  assert.equal(followUpStage(item, addDays(TODAY, 29)), null);
  assert.equal(followUpStage(item, addDays(TODAY, 30)), 30);
  assert.equal(followUpStage(item, addDays(TODAY, 45)), 30, 'still due if the member missed day 30');

  // "No" at day 31: open, but not asked again until 60.
  const no = { ...item, ...followUpAnswer('No', addDays(TODAY, 31)) };
  assert.equal(no.status, 'open');
  assert.equal(no.last_answer, 'no');
  assert.equal(followUpStage(no, addDays(TODAY, 32)), null);
  assert.equal(followUpStage(no, addDays(TODAY, 59)), null);
  assert.equal(followUpStage(no, addDays(TODAY, 60)), 60);

  // Answered at 60, even "No": the asking ends.
  const no60 = { ...no, ...followUpAnswer('No', addDays(TODAY, 60)) };
  assert.equal(followUpStage(no60, addDays(TODAY, 61)), null);
  assert.equal(followUpStage(no60, addDays(TODAY, 200)), null);

  // A member who skipped the 30-day ask entirely gets the 60-day one.
  assert.equal(followUpStage(item, addDays(TODAY, 61)), 60);
});

test('Yes and Scheduled close the loop; nothing closed is ever asked about', () => {
  assert.deepEqual(followUpAnswer('Yes', TODAY), { status: 'discussed', last_answer: 'yes', last_asked_on: TODAY });
  assert.deepEqual(followUpAnswer('Scheduled', TODAY), { status: 'scheduled', last_answer: 'scheduled', last_asked_on: TODAY });
  assert.equal(followUpAnswer('Maybe', TODAY), null);
  for (const status of ['discussed', 'scheduled', 'dismissed']) {
    assert.equal(followUpStage({ status, due_30: '2026-01-01', due_60: '2026-02-01' }, TODAY), null);
  }
});

test('one question per morning: the oldest due follow-up', () => {
  const items = [
    { id: 'new', marker: 'alt', marker_name: 'ALT', status: 'open', due_30: '2026-10-10', due_60: '2026-11-09' },
    { id: 'old', marker: 'ferritin', marker_name: 'Ferritin', status: 'open', due_30: '2026-09-01', due_60: '2026-10-01' },
    { id: 'notyet', marker: 'hdl', marker_name: 'HDL cholesterol', status: 'open', due_30: '2026-11-01', due_60: '2026-12-01' },
  ];
  const due = dueFollowUp(items, TODAY);
  assert.equal(due.item.id, 'old');
  assert.equal(due.stage, 60);
  assert.equal(dueFollowUp([items[2]], TODAY), null);
  assert.equal(dueFollowUp([], TODAY), null);
});

test('the question reads naturally and says "It\'s still waiting" at 60 days', () => {
  const item = { id: 'f1', marker: 'ferritin', marker_name: 'Ferritin' };
  const q30 = followUpQuestion({ item, stage: 30 });
  assert.equal(q30.label, 'Have you had a chance to discuss your ferritin with your healthcare provider?');
  assert.deepEqual(q30.options, ['Yes', 'No', 'Scheduled']);
  assert.equal(q30.type, 'choice');
  assert.equal(q30.followUpId, 'f1');
  assert.match(followUpQuestion({ item, stage: 60 }).label, /^It's still waiting\. Have you had a chance to discuss your ferritin/);
  // Abbreviations keep their capitals.
  assert.deepEqual(['HbA1c', 'ApoB', 'Lp(a)', 'eGFR', 'hs-CRP', 'Vitamin D, 25-OH', 'White blood cell count'].map(markerPhrase),
    ['HbA1c', 'ApoB', 'Lp(a)', 'eGFR', 'hs-CRP', 'vitamin D, 25-OH', 'white blood cell count']);
});
