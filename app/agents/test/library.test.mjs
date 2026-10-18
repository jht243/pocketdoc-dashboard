// The knowledge library: every passage is well-formed and still awaiting the medical
// director, none of them would trip the app's own safety net if an agent quoted it,
// the escalation matrix is usable as data, and each specialist's sample questions
// find passages in its own sections.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { TEAM } = await import('../lib/team.mjs');
const { searchReference } = await import('../lib/knowledge.mjs');
const { violatesForbiddenOutput } = await import('../../src/lib/clinicalRules.js');
const { listPassages } = await import('../library/readme.mjs');

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', 'library');
const SECTIONS = [...new Set(Object.values(TEAM).flatMap((t) => t.library))];
const passages = listPassages();

test('every library section has at least five passages', () => {
  for (const section of SECTIONS) {
    const n = passages.filter((p) => p.section === section).length;
    assert.ok(n >= 5, `${section} has ${n} passages`);
  }
});

test('no passage sits outside a section some specialist searches', () => {
  const dirs = readdirSync(join(LIB, 'reference'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const d of dirs) assert.ok(SECTIONS.includes(d), `library/reference/${d} is searched by no specialist`);
});

test('every passage has valid frontmatter and is awaiting the medical director', () => {
  const titles = new Map();
  for (const p of passages) {
    const at = p.path;
    assert.match(p.raw, /^---\n[\s\S]*?\n---\n/, `${at}: frontmatter block`);
    assert.ok(p.title, `${at}: title`);
    assert.doesNotMatch(p.title, /["()]/, `${at}: a title is cited as (per "Title"), so it holds no quotes or brackets`);
    assert.ok(p.source, `${at}: source`);
    assert.ok(['Strong', 'Moderate', 'Emerging'].includes(p.evidence), `${at}: evidence is "${p.evidence}"`);
    assert.equal(p.approved_by, 'pending', `${at}: approved_by`);
    assert.match(p.as_of || '', /^\d{4}(-\d{2})?$/, `${at}: as_of`);
    const key = p.title.toLowerCase();
    assert.ok(!titles.has(key), `${at}: title also used by ${titles.get(key)}`);
    titles.set(key, at);
  }
});

test('every passage is one short rule: 80 to 250 words', () => {
  for (const p of passages) {
    const words = p.body.split(/\s+/).filter(Boolean).length;
    assert.ok(words >= 80 && words <= 250, `${p.path}: ${words} words`);
  }
});

test('no passage would trip the safety net if an agent quoted it (doses, med changes, diagnoses)', () => {
  for (const p of passages) {
    for (const para of p.body.split(/\n\s*\n/)) {
      assert.equal(violatesForbiddenOutput(para), null, `${p.path}: ${para.slice(0, 120)}`);
    }
  }
});

test('any vitamin D level target is labelled Emerging and states the Endocrine Society position', () => {
  // A "functional", "optimal" or "longevity" range for 25-OH-D in one sentence, e.g. "aim for 50 to 80 ng/mL".
  const target = /\b(?:target|optimal|functional|longevity)\b[^.]*\b\d+\s*(?:to|-|–)\s*\d+\s*ng\/mL/i;
  for (const p of passages.filter((x) => /vitamin d|25-oh|25\(oh\)d/i.test(x.title + x.body) && target.test(x.body))) {
    assert.equal(p.evidence, 'Emerging', `${p.path}: a 25-OH-D target must be Emerging`);
    assert.match(p.body, /Endocrine Society/, `${p.path}: states the guideline position`);
  }
});

test('the README lists every passage as awaiting approval', () => {
  const readme = readFileSync(join(LIB, 'README.md'), 'utf8');
  assert.match(readme, /awaiting medical-director approval/i);
  for (const p of passages) assert.ok(readme.includes(p.path), `README is missing ${p.path}; run npm run library:readme`);
});

test('the escalation matrix is usable as data', () => {
  const m = JSON.parse(readFileSync(join(LIB, 'escalation.json'), 'utf8'));
  assert.equal(m.approved_by, 'pending');
  const triggers = Object.keys(m.triggers);
  const bound = (r) => ['gt', 'gte', 'lt', 'lte'].some((k) => k in r);
  const ok = (v) => typeof v === 'number' || v === 'lab_high' || v === 'lab_low';
  for (const [id, mk] of Object.entries(m.markers)) {
    assert.ok(mk.name && mk.unit && mk.domain, `${id}: name, unit, domain`);
    assert.ok(['self', 'provider'].includes(mk.default_lane), `${id}: default_lane`);
    assert.ok(mk.provider.length, `${id}: at least one provider rule`);
    for (const r of mk.provider) {
      assert.ok(['flag', 'immediate'].includes(r.level), `${id}: level ${r.level}`);
      assert.ok(bound(r), `${id}: rule has a bound`);
      for (const k of ['gt', 'gte', 'lt', 'lte']) if (k in r) assert.ok(ok(r[k]), `${id}: ${k} is ${r[k]}`);
    }
    for (const c of mk.conditions) assert.ok(triggers.includes(c.trigger), `${id}: unknown trigger ${c.trigger}`);
  }
  // hs-CRP is reported in mg/L; spec #25 printed mg/dL by mistake.
  assert.equal(m.markers.hs_crp.unit, 'mg/L');
  assert.deepEqual(m.markers.hs_crp.provider.map((r) => r.gte), [3, 10]);
  assert.equal(m.markers.lpa.default_lane, 'provider');
  for (const r of m.emergency.rules) assert.ok(m.markers[r.marker] && bound(r), `emergency rule for ${r.marker}`);
});

// A member's question → the section that should answer it first.
const SAMPLES = {
  bloodwork: [
    ['What should my LDL cholesterol be?', 'lipids-cardio'],
    ['My Lp(a) is 180 nmol/L', 'lipids-cardio'],
    ['Is my A1c in the prediabetes range?', 'metabolic'],
    ['What does my eGFR say about my kidneys?', 'kidney-liver'],
    ['Is my ferritin low? Am I iron deficient?', 'blood-iron'],
    ['How is my biological age calculated with PhenoAge?', 'bio-age'],
    ['What does a high hs-CRP mean?', 'inflammation'],
    ['When should I start colon cancer screening?', 'preventive'],
    ['Should I get my vitamin D level tested?', 'vitamins'],
  ],
  hormones: [
    ['My TSH came back high, is my thyroid underactive?', 'thyroid'],
    ['Is menopause hormone therapy safe for my hot flashes?', 'hormones-female'],
    ['What total testosterone level counts as low T in men?', 'hormones-male'],
    ['Is BPC-157 legal? What is the FDA status of peptides?', 'peptides'],
  ],
  medications: [
    ['Does my statin interact with grapefruit?', 'medications'],
    ['I am a CYP2C19 poor metabolizer on clopidogrel', 'pharmacogenomics'],
    ['Is ashwagandha safe for my liver?', 'supplements'],
  ],
  lifestyle: [
    ['How much protein should I eat?', 'nutrition'],
    ['How many hours of sleep do I need?', 'sleep'],
    ['How many steps a day should I walk?', 'activity'],
  ],
};

for (const [id, samples] of Object.entries(SAMPLES)) {
  test(`${id}: sample questions find passages in its own sections`, () => {
    for (const [q, want] of samples) {
      const got = searchReference(TEAM[id].library, q, 5);
      assert.ok(got.length > 0, `"${q}" found nothing`);
      for (const p of got) assert.ok(TEAM[id].library.includes(p.section), `"${q}" returned ${p.path}, outside ${id}'s sections`);
      assert.equal(got[0].section, want, `"${q}" ranked ${got[0].path} first`);
      assert.ok(got.every((p) => p.approved === false), 'every passage is still pending approval');
    }
  });
}
