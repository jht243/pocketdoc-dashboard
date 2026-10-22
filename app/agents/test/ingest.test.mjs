// Reading a document is the care team's job (lib/ingest.mjs): the specialist reads
// with the document tools, the Fact Checker reads independently, code files only what
// both support. The model is stubbed to replay what happened on Oct 21 2026: a scan
// "transcribed" with most values invented.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { runIngest } = await import('../lib/ingest.mjs');
const { readEvidence, toolsAvailable } = await import('../lib/docTools.mjs');
const { CHECKED_MARK, UNCLEAR_MARK } = await import('../../src/lib/readCheck.js');

const fixture = (f) => readFileSync(new URL(`fixtures/${f}`, import.meta.url)).toString('base64');

const TRUTH_ROWS = `Collected: 10/14/2026 07:45
Reported: 10/15/2026
Glucose, Fasting: 112 mg/dL (65-99)
Creatinine: 1.05 mg/dL (0.76-1.27)
Albumin: 4.2 g/dL (3.8-4.9)
Alkaline Phosphatase: 96 IU/L (44-121)
ALT (SGPT): 48 IU/L (0-44)
WBC: 7.8 x10E3/uL (3.4-10.8)
Lymphs: 24 % (not estab.)
MCV: 92 fL (79-97)
RDW: 14.1 % (11.6-15.4)
C-Reactive Protein, Cardiac (hs-CRP): 3.4 mg/L (0.00-3.00)
Hemoglobin A1c: 6.0 % (4.8-5.6)
Triglycerides: 188 mg/dL (0-149)
HDL Cholesterol: 38 mg/dL (>39)
TSH: 2.1 uIU/mL (0.450-4.500)`;

const INVENTED = `TEST LABORATORY - SAMPLE REPORT (TEST DATA)
Patient: Test Member  Collected: 10/14/2026 07:45 (fasting)  Reported: 10/15/2026
Glucose, Fasting: 91 mg/dL (65-99)
Creatinine: 1.12 mg/dL (0.76-1.27)
Albumin: 4.3 g/dL (3.5-5.0)
Alkaline Phosphatase: 55 IU/L (46-116)
ALT (SGPT): 28 IU/L (0-44)
WBC: 7.8 x10E3/uL (3.4-10.8)
Neutrophils: 56 % (Not Estab.)
MCV: 87 fL (80-100)
RDW: 14.1 % (11.5-14.5)
C-Reactive Protein, (hs-CRP): 3.0 mg/L (<3.0)
Hemoglobin A1c: 6.3 % (4.8-5.6)
TSH: 1.5 uIU/mL (0.45-4.5)
Vitamin D, 25-Hydroxy: 21 ng/mL (30-100)`;

// The extractor turns whatever transcription it is given into markers, faithfully.
function extractFrom(text) {
  const markers = [];
  for (const line of text.split('\n')) {
    const m = /^(.+?):\s*([\d.]+)\s+(\S+)\s*\((.*?)\)/.exec(line.trim())
      || /^(.+?)\s{2,}([\d.]+)\s{2,}(\S+)\s{2,}(.+)$/.exec(line.trim()); // a PDF text-layer row
    if (m) markers.push({ name: m[1], value: m[2], unit: m[3], range: m[4], status: 'unknown' });
  }
  return JSON.stringify({ drawn_on: '2026-10-14', source: 'TEST LABORATORY', markers });
}

function stub({ transcribe, check = TRUTH_ROWS, settle = TRUTH_ROWS, extract }) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    const user = body.messages.at(-1).content;
    const prompt = Array.isArray(user) ? user.filter((p) => p.type === 'text').map((p) => p.text).join('\n') : user;
    const images = Array.isArray(user) ? user.filter((p) => p.type === 'image_url') : [];
    calls.push({ system, prompt, images });
    let content;
    if (system.includes('Agent: Fact Checker')) content = prompt.includes('Read 2') ? settle : check;
    else if (prompt.includes('Task 2')) content = extract ? extract(prompt) : extractFrom(prompt.split('Checked transcription:')[1] || '');
    else content = transcribe;
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  };
  return calls;
}

test('the reading tools load and tell a text PDF from a scan', async () => {
  assert.equal(await toolsAvailable(), true);
  const text = await readEvidence({ file: fixture('lab-text-layer.pdf'), mediaType: 'application/pdf' });
  assert.equal(text.kind, 'pdf-text');
  assert.match(text.text, /Glucose, Fasting\s+112\s+mg\/dL/);
  const scan = await readEvidence({ file: fixture('lab-scan.pdf'), mediaType: 'application/pdf' });
  assert.equal(scan.kind, 'scan');
  assert.equal(scan.pages.length, 1);
  assert.match(scan.pages[0], /^data:image\/jpeg;base64,/);
  // A PDF labelled as an image on a phone is still read as a PDF.
  assert.equal((await readEvidence({ file: fixture('lab-scan.pdf'), mediaType: 'image/jpeg' })).kind, 'scan');
});

test('a scan read with invented values: the Fact Checker catches them and only the truth is filed', async () => {
  const calls = stub({ transcribe: INVENTED });
  const run = { ledger: [], safety: [] };
  const out = await runIngest({ kind: 'labs', file: fixture('lab-scan.pdf'), mediaType: 'application/pdf', run });
  // Who did what: the specialist read the sharp page, the Fact Checker read it too.
  assert.equal(out.readBy, 'bloodwork');
  assert.equal(out.checkedBy, 'fact-checker');
  assert.ok(calls.some((c) => c.system.includes('Agent: Blood Work, reading a lab report') && c.images.length === 1 && c.images[0].image_url.detail === 'high'));
  assert.ok(calls.filter((c) => c.system.includes('Agent: Fact Checker')).length >= 2);
  const filed = Object.fromEntries(out.markers.map((m) => [m.name, m.value]));
  assert.equal(filed['Glucose, Fasting'], '112');
  assert.equal(filed.Creatinine, '1.05');
  assert.equal(filed['Alkaline Phosphatase'], '96');
  assert.equal(filed['Hemoglobin A1c'], '6.0');
  assert.equal(filed.TSH, '2.1');
  assert.equal(filed.Triglycerides, '188');
  for (const [name, value] of Object.entries(filed)) assert.ok(TRUTH_ROWS.includes(`${name}: ${value} `), `${name} ${value} is on the report`);
  assert.ok(!('Vitamin D, 25-Hydroxy' in filed), 'the invented vitamin D is never filed');
  assert.ok(out.unclear.some((u) => /Vitamin D/.test(u)));
  assert.ok(out.text.startsWith(CHECKED_MARK));
  assert.equal(out.drawnOn, '2026-10-14');
  assert.ok(run.safety.some((e) => e.kind === 'fact_check' && /did not agree/.test(e.rule)));
});

test('when the Fact Checker cannot settle a row, it is marked unclear, never guessed', async () => {
  stub({ transcribe: 'Collected: 10/14/2026\nGlucose, Fasting: 91 mg/dL (65-99)\nAlbumin: 4.2 g/dL (3.8-4.9)\nWBC: 7.8 x10E3/uL (3.4-10.8)', settle: 'Glucose, Fasting: UNREADABLE' });
  const out = await runIngest({ kind: 'labs', file: fixture('lab-scan.pdf'), mediaType: 'application/pdf', run: { ledger: [], safety: [] } });
  assert.ok(!out.markers.some((m) => /Glucose/.test(m.name)));
  assert.ok(out.text.includes(`Glucose, Fasting: ${UNCLEAR_MARK}`));
  assert.deepEqual(out.markers.map((m) => m.name).sort(), ['Albumin', 'WBC']);
});

test("a text PDF is read from its own text; a number the specialist changed is caught in code", async () => {
  const calls = stub({ transcribe: 'Glucose, Fasting: 91 mg/dL (65-99)\nTSH: 2.1 uIU/mL (0.450-4.500)\nAlbumin: 4.2 g/dL (3.8-4.9)' });
  const run = { ledger: [], safety: [] };
  const out = await runIngest({ kind: 'labs', file: fixture('lab-text-layer.pdf'), mediaType: 'application/pdf', run });
  assert.ok(!calls.some((c) => c.images.length), 'no images: the text layer is the document');
  assert.ok(!calls.some((c) => c.system.includes('Agent: Fact Checker')), 'code checks a text layer');
  assert.ok(run.safety.some((e) => /changed or added numbers/.test(e.rule)));
  // The raw text layer was kept, so glucose is filed as printed.
  assert.equal(out.markers.find((m) => /Glucose/.test(m.name))?.value, '112');
});

test('a marker the extractor invents is dropped against the checked text', async () => {
  stub({
    transcribe: TRUTH_ROWS, check: TRUTH_ROWS,
    extract: () => JSON.stringify({ drawn_on: '2026-10-20', source: 'Quest', markers: [
      { name: 'Glucose, Fasting', value: '112', unit: 'mg/dL', range: '65-99' },
      { name: 'Ferritin', value: '22', unit: 'ng/mL', range: '30-400' },
    ] }),
  });
  const out = await runIngest({ kind: 'labs', file: fixture('lab-scan.pdf'), mediaType: 'application/pdf', run: { ledger: [], safety: [] } });
  assert.deepEqual(out.markers.map((m) => m.name), ['Glucose, Fasting']);
  assert.deepEqual(out.dropped, ['Ferritin']);
  // The collection date is the printed one, read in code, never the extractor's 2026-10-20;
  // a lab name that isn't printed is not filed.
  assert.equal(out.drawnOn, '2026-10-14');
  assert.equal(out.source, null);
  // Ranges are filed as printed, without the transcription's brackets.
  assert.equal(out.markers[0].range, '65-99');
});

test('genetics: the Genetics specialist reads, and only what the report prints is filed', async () => {
  const report = 'MTHFR  rs1801133  C/T\nYour result may reduce folate conversion.\nAPOE  rs429358  T/T';
  const calls = stub({
    transcribe: report, check: 'MTHFR  rs1801133  C/T\nAPOE  rs429358  T/T',
    extract: () => JSON.stringify([
      { gene: 'MTHFR', rsid: 'rs1801133', genotype: 'CT', notes: 'Your result may reduce folate conversion.', summary: 'MTHFR makes an enzyme…', recommendations: ['Take methylfolate daily'] },
      { gene: 'APOE', rsid: 'rs429358', genotype: 'CC' },
      { gene: 'BRCA1', genotype: 'AG' },
    ]),
  });
  const out = await runIngest({ kind: 'genetic', file: fixture('lab-scan.pdf'), mediaType: 'application/pdf', run: { ledger: [], safety: [] } });
  assert.ok(calls.some((c) => c.system.includes('Agent: Genetics, reading a DNA report')));
  assert.deepEqual(out.genetics.map((g) => g.gene), ['MTHFR']);
  assert.deepEqual(out.dropped, ['APOE', 'BRCA1']);
  const mthfr = out.genetics[0];
  assert.equal(mthfr.notes, 'Your result may reduce folate conversion.');
  assert.equal(mthfr.summary, null, 'the extractor\'s own summary is never filed');
  assert.deepEqual(mthfr.recommendations, [], 'a recommendation the report does not make is never filed');
});
