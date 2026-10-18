// Test dates over upload dates (Adam, Oct 15). Four Quest panels drawn months apart
// all read "Aug 28, 2026" — the day they were uploaded — and the newest-reading picks
// let an upload timestamp outrank the day the blood was drawn.
//
// Two pure modules: the lab-date ordering in src/lib/clinicalRules.js, and the
// document-naming rules in src/lib/documentNames.js, including the one-time rename of
// documents named under the old "— Aug 2026" scheme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labDay, compareLabsNewestFirst, describeLabAge } from '../../src/lib/clinicalRules.js';
import {
  needsContentName, needsTestDate, needsNaming, cleanName, cleanTestDate, parseNameReply,
} from '../../src/lib/documentNames.js';

const newest = (labs) => [...labs].sort(compareLabsNewestFirst)[0];

test('a panel drawn in March and uploaded today is not newer than a June draw', () => {
  const marchUploadedToday = { name: 'Vitamin D', value: '22', drawnOn: '2026-03-02', created_at: '2026-10-17T15:00:00Z' };
  const juneUploadedJuly = { name: 'Vitamin D', value: '31', drawnOn: '2026-06-20', created_at: '2026-07-01T09:00:00Z' };
  assert.equal(newest([marchUploadedToday, juneUploadedJuly]).value, '31');
  assert.equal(newest([juneUploadedJuly, marchUploadedToday]).value, '31');
});

test("the source document's test date stands in for a missing draw date", () => {
  const datedByDocument = { value: 'B', collectedOn: '2026-09-17', created_at: '2026-08-28T12:00:00Z' };
  const drawnEarlier = { value: 'A', drawnOn: '2026-09-01', created_at: '2026-10-01T12:00:00Z' };
  assert.equal(labDay(datedByDocument), '2026-09-17');
  assert.equal(newest([drawnEarlier, datedByDocument]).value, 'B');
});

test('a display date outranks the upload time', () => {
  const lab = { date: 'Jun 2026', created_at: '2026-08-28T12:00:00Z' };
  assert.equal(labDay(lab), '2026-06-01');
  assert.equal(labDay({ date: 'Sep 17, 2026', created_at: '2026-08-28T12:00:00Z' }), '2026-09-17');
});

test('the upload time is only the last resort, and undated readings sort last', () => {
  assert.equal(labDay({ created_at: '2026-08-28T23:59:00Z' }), '2026-08-28');
  assert.equal(labDay({ date: 'sometime last spring' }), '');
  const undated = { value: 'none' };
  const dated = { value: 'dated', drawnOn: '2019-01-01' };
  assert.equal(newest([undated, dated]).value, 'dated');
});

test('on the same draw day the later upload wins', () => {
  const first = { value: 'first', drawnOn: '2026-06-14', created_at: '2026-06-20T08:00:00Z' };
  const corrected = { value: 'corrected', drawnOn: '2026-06-14', created_at: '2026-06-21T08:00:00Z' };
  assert.equal(newest([first, corrected]).value, 'corrected');
});

test('lab age is measured from the draw, not the upload', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  const age = describeLabAge({ drawnOn: '2025-09-01', created_at: '2026-10-17T12:00:00Z' }, now);
  assert.equal(age.tier, 'historical');
});

test('new titles are short, dateless, and never look unnamed', () => {
  assert.equal(cleanName('"Quest Bloodwork"'), 'Quest Bloodwork');
  assert.equal(cleanName('Quest Bloodwork — Aug 2026'), 'Quest Bloodwork');
  assert.equal(cleanName('Labcorp Bloodwork - Sep 17, 2026'), 'Labcorp Bloodwork');
  assert.equal(cleanName('UNKNOWN'), null);
  assert.equal(needsContentName(cleanName('Report v2.pdf')), false);
});

test('the reply is read as JSON, salvaged, or taken as a bare title', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.deepEqual(parseNameReply('{"title": "Quest Bloodwork", "collected_on": "2026-09-17"}', now),
    { title: 'Quest Bloodwork', collectedOn: '2026-09-17' });
  assert.deepEqual(parseNameReply('```json\n{"title": "AncestryDNA Longevity Report", "collected_on": null}\n```', now),
    { title: 'AncestryDNA Longevity Report', collectedOn: null });
  assert.deepEqual(parseNameReply('Here you go: {"title": "Rhythm Bloodwork", "collected_on": "2026-05-02"', now),
    { title: 'Rhythm Bloodwork', collectedOn: '2026-05-02' });
  assert.deepEqual(parseNameReply('Cardiology Visit Note', now), { title: 'Cardiology Visit Note', collectedOn: null });
  assert.deepEqual(parseNameReply('{"title": "UNKNOWN", "collected_on": null}', now), { title: null, collectedOn: null });
});

test('implausible test dates are dropped rather than believed', () => {
  const now = Date.parse('2026-10-18T12:00:00Z');
  assert.equal(cleanTestDate('2026-09-17', now), '2026-09-17');
  assert.equal(cleanTestDate('2026-02-30', now), null);
  assert.equal(cleanTestDate('2027-01-05', now), null);
  assert.equal(cleanTestDate('1902-04-12', now), null);
  assert.equal(cleanTestDate('Sep 17, 2026', now), null);
  assert.equal(cleanTestDate(null, now), null);
});

test('documents with the old dated name are renamed once, and only once', () => {
  const old = { file_name: 'Quest Diagnostics Annual Blood Panel — Aug 2026', collected_on: null };
  assert.equal(needsTestDate(old), true);
  assert.equal(needsNaming(old), true);

  // After the rename, with or without a date found, nothing matches again.
  const renamed = { ...old, file_name: 'Quest Bloodwork', collected_on: '2026-03-04' };
  const renamedNoDate = { ...old, file_name: 'Quest Bloodwork', collected_on: null };
  assert.equal(needsNaming(renamed), false);
  assert.equal(needsNaming(renamedNoDate), false);

  // The model couldn't place it: the fallback name is the old one minus its date.
  assert.equal(needsNaming({ ...old, file_name: cleanName(old.file_name) }), false);

  // Already has its test date: leave it alone.
  assert.equal(needsTestDate({ ...old, collected_on: '2026-03-04' }), false);
});

test('before the collected_on column exists, dated names are left alone', () => {
  // The row has no collected_on key at all when the migration hasn't run.
  assert.equal(needsNaming({ file_name: 'Quest Diagnostics Lipid Panel — Mar 2024' }), false);
  // Upload names are still named, as before.
  assert.equal(needsNaming({ file_name: 'IMG_4821.HEIC' }), true);
});
