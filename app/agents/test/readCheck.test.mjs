// Lab import must not invent values (src/lib/readCheck.js). On Oct 21 2026 a scanned
// report was transcribed with its header right and most values invented. These tests
// use that report: its real rows, and the transcription the model actually produced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  UNCLEAR_MARK, applyTieBreak, hasUsableText, linesFromItems, numbersOf, reconcile,
  traceMarkers, unclearNames, untracedAgainst,
} from '../../src/lib/readCheck.js';

// What the report says (fixtures/lab-scan.pdf and lab-text-layer.pdf).
const TRUTH = `Collected: 10/14/2026 07:45 (fasting)
Glucose, Fasting: 112 mg/dL (65-99)
Creatinine: 1.05 mg/dL (0.76-1.27)
Albumin: 4.2 g/dL (3.8-4.9)
Alkaline Phosphatase: 96 IU/L (44-121)
ALT (SGPT): 48 IU/L (0-44)
WBC: 7.8 x10E3/uL (3.4-10.8)
Lymphs: 24 % (Not Estab.)
MCV: 92 fL (79-97)
RDW: 14.1 % (11.6-15.4)
C-Reactive Protein, Cardiac: 3.4 mg/L (0.00-3.00)
Hemoglobin A1c: 6.0 % (4.8-5.6)
Triglycerides: 188 mg/dL (0-149)
HDL Cholesterol: 38 mg/dL (>39)
TSH: 2.1 uIU/mL (0.450-4.500)`;

// What the model wrote from the scan, live, on Oct 21 2026.
const INVENTED = `TEST LABORATORY - SAMPLE REPORT (TEST DATA)

Patient: Test Member  Collected: 10/14/2026 07:45 (fasting)  Reported: 10/15/2026

Comprehensive Metabolic Panel
Glucose, Fasting: 91 mg/dL (65-99)
Creatinine: 1.12 mg/dL (0.76-1.27)
Albumin: 4.3 g/dL (3.5-5.0)
Alkaline Phosphatase: 55 IU/L (46-116)
ALT (SGPT): 28 IU/L (0-44)

CBC With Differential
WBC: 7.8 x10E3/uL (3.4-10.8)
Neutrophils: 56 % (Not Estab.)
MCV: 87 fL (80-100)
RDW: 14.1 % (11.5-14.5)

Other Tests
C-Reactive Protein, (hs-CRP): 3.0 mg/L (<3.0) — High
Hemoglobin A1c: 6.3 % (4.8-5.6) — High
TSH: 1.5 uIU/mL (0.45-4.5)
Vitamin D, 25-Hydroxy: 21 ng/mL (30-100) — Low`;

test('numbers are read the way a report prints them', () => {
  assert.deepEqual(numbersOf('Glucose, Fasting: 112 mg/dL (65-99)'), ['112', '65', '99']);
  assert.deepEqual(numbersOf('WBC: 7.8 x10E3/uL (3.4-10.8)'), ['7.8', '3.4', '10.8']);
  assert.deepEqual(numbersOf('TSH: 2.10 uIU/mL'), ['2.1']);
  assert.deepEqual(numbersOf('Platelets 1,250'), ['1250']);
});

test('the invented transcription is caught row by row, and a third read settles it', () => {
  const found = reconcile(INVENTED, TRUTH);
  // Only the date line, WBC and TSH-free rows agree; every invented value is disputed.
  const disputedRows = found.disputed.map((d) => d.primary);
  for (const bad of ['Glucose, Fasting: 91', 'Creatinine: 1.12', 'Alkaline Phosphatase: 55', 'ALT (SGPT): 28', 'MCV: 87', 'Hemoglobin A1c: 6.3', 'TSH: 1.5', 'Vitamin D, 25-Hydroxy: 21']) {
    assert.ok(disputedRows.some((r) => r.startsWith(bad)), bad);
  }
  assert.ok(found.agreed.some((r) => r.startsWith('WBC: 7.8')));
  // Rows the first read dropped are found by the second.
  for (const dropped of ['Triglycerides', 'HDL Cholesterol']) assert.ok(found.missing.some((r) => r.startsWith(dropped)), dropped);

  // The third read agrees with the report.
  const { text, unclear, recovered } = applyTieBreak(INVENTED, found, TRUTH);
  for (const right of ['Glucose, Fasting: 112 mg/dL (65-99)', 'Creatinine: 1.05', 'Alkaline Phosphatase: 96', 'ALT (SGPT): 48', 'MCV: 92', 'Hemoglobin A1c: 6.0', 'TSH: 2.1']) {
    assert.ok(text.includes(right), right);
  }
  for (const wrong of ['91 mg/dL', '1.12 mg/dL', '55 IU/L', '6.3 %', '1.5 uIU/mL', '21 ng/mL']) assert.ok(!text.includes(wrong), wrong);
  // Vitamin D is not on the report: no read confirms it, so it is never a result.
  assert.ok(unclear.some((u) => /Vitamin D/.test(u)));
  assert.ok(unclearNames(text).some((u) => /Vitamin D/.test(u)));
  assert.ok(recovered.some((r) => r.startsWith('Triglycerides: 188')));
  assert.ok(recovered.some((r) => r.startsWith('HDL Cholesterol: 38')));
});

test('when the third read agrees with neither, the row is unclear, not guessed', () => {
  const found = reconcile('Glucose: 91 mg/dL (65-99)\nAlbumin: 4.2 g/dL (3.8-4.9)\nWBC: 7.8 x10E3/uL', 'Glucose: 112 mg/dL (65-99)\nAlbumin: 4.2 g/dL (3.8-4.9)\nWBC: 7.8 x10E3/uL');
  const { text, unclear } = applyTieBreak('Glucose: 91 mg/dL (65-99)\nAlbumin: 4.2 g/dL (3.8-4.9)\nWBC: 7.8 x10E3/uL', found, 'Glucose: 102 mg/dL (65-99)');
  assert.deepEqual(unclear, ['Glucose']);
  assert.ok(text.includes(`Glucose: ${UNCLEAR_MARK}`));
  assert.ok(!/\b91\b|\b102\b|\b112\b/.test(text.split('\n')[0]));
  // And a third read that agrees with the second replaces the first's value.
  assert.ok(applyTieBreak('Glucose: 91 mg/dL (65-99)', reconcile('Glucose: 91 mg/dL (65-99)', 'Glucose: 112 mg/dL (65-99)'), 'Glucose: 112 mg/dL (65-99)').text.includes('112'));
});

test('a marker that does not trace to its own row is not filed', () => {
  const text = 'Glucose, Fasting: 112 mg/dL (65-99)\nTSH: 2.1 uIU/mL (0.450-4.500)\nHDL Cholesterol: 38 mg/dL (>39)';
  const { kept, dropped } = traceMarkers([
    { name: 'Glucose, Fasting', value: '112', unit: 'mg/dL', range: '65-99', status: 'high' },
    { name: 'TSH', value: '1.5', unit: 'uIU/mL', range: '0.45-4.5', status: 'normal' },          // value not on the row
    { name: 'Vitamin D, 25-Hydroxy', value: '21', unit: 'ng/mL', range: '30-100', status: 'low' }, // not on the document
    { name: 'HDL Cholesterol', value: '38', unit: 'mmol/L', range: '>39', status: 'low' },       // wrong unit
  ], text);
  assert.deepEqual(kept.map((m) => m.name), ['Glucose, Fasting']);
  assert.deepEqual(dropped, ['TSH', 'Vitamin D, 25-Hydroxy', 'HDL Cholesterol']);
  // A range the row doesn't print is cleared, not trusted.
  const { kept: k2 } = traceMarkers([{ name: 'TSH', value: '2.1', unit: 'uIU/mL', range: '0.4-4.0', status: 'normal' }], text);
  assert.equal(k2[0].range, null);
  assert.equal(k2[0].status, 'unknown');
});

const pdfText = async (file) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(new URL(`fixtures/${file}`, import.meta.url)));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const page = await doc.getPage(1);
  return linesFromItems((await page.getTextContent()).items);
};

test("a PDF's own text layer is read as printed, every value on its row", async () => {
  const text = await pdfText('lab-text-layer.pdf');
  assert.ok(hasUsableText(text));
  for (const row of TRUTH.split('\n').slice(1)) {
    const [name] = row.split(':');
    const line = text.split('\n').find((l) => l.startsWith(name));
    assert.ok(line, `${name} row`);
    for (const n of numbersOf(row.slice(name.length))) assert.ok(numbersOf(line).includes(n), `${name} ${n}`);
  }
  // A model that changes a number while reformatting it is caught against the layer.
  assert.deepEqual(untracedAgainst('Glucose, Fasting: 91 mg/dL (65-99)\nTSH: 2.1 uIU/mL', text), ['91']);
  assert.deepEqual(untracedAgainst('Glucose, Fasting: 112 mg/dL (65-99)', text), []);
});

test('a scan has no usable text layer, so it goes to the checked reads', async () => {
  assert.equal(hasUsableText(await pdfText('lab-scan.pdf')), false);
});

test('dates are checked on their own: a header is never blanked as a disputed result', async () => {
  const { checkDates, DATE_UNCLEAR } = await import('../../src/lib/readCheck.js');
  const header = 'Patient: Test Member  Collected: 10/14/2026 07:45 (fasting)  Reported: 10/15/2026';
  const found = reconcile(`${header}\nGlucose: 112 mg/dL`, 'Collected: 10/14/2026 07:45\nReported: 10/15/2026\nGlucose: 112 mg/dL');
  assert.equal(found.disputed.length, 0);
  assert.equal(found.missing.length, 0);
  // A date only one read saw is replaced, not trusted.
  const { text, unclear } = checkDates(header, 'Collected: 10/14/2026');
  assert.ok(text.includes('10/14/2026'));
  assert.ok(text.includes(`Reported: ${DATE_UNCLEAR}`));
  assert.deepEqual(unclear, ['10/15/2026']);
});
