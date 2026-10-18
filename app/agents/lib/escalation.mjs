// Routing lanes: pipeline step 5 (DESIGN.md), in code.
//
// Every marker on file is matched against the escalation matrix (spec #25, Section 4,
// library/escalation.json) and lands in one lane:
//   self      "You can act on this"          (Lane 1)
//   provider  "Bring this to your provider"  (Lane 2), level flag | immediate
// and the Section 9 emergency overrides are found here too. The model never decides
// a lane; compose is handed these cards and told to keep them.
//
// The thresholds live in escalation.json and nowhere else. Nothing here is live
// clinical guidance until the medical director approves the matrix.
import { readFileSync } from 'node:fs';
import { describeLabAge } from '../../src/lib/clinicalRules.js';

export const MATRIX = JSON.parse(readFileSync(new URL('../library/escalation.json', import.meta.url), 'utf8'));

/* ---------------- lab names → matrix marker ids ---------------- */

// The aliases are the bloodwork scorer's (supabase/functions/_shared/bloodworkScore.js)
// and clinicalRules.js's, so a row the score reads as ferritin is the row routed as
// ferritin. Markers the scorer does not carry (creatinine, albumin, RDW, WBC,
// homocysteine) use clinicalRules.js's WBC list and the names labs print.
// `excludes` are the neighbours that share a word and are a different test.
const NAMES = {
  fasting_glucose: { aliases: ['fasting glucose', 'glucose fasting', 'glucose', 'fasting blood glucose', 'fbg', 'fasting plasma glucose', 'blood glucose'], excludes: ['urine', 'tolerance', 'csf', 'random', 'post', '2 hour', '2-hour', '1 hour', 'average', 'eag', 'estimated'] },
  hba1c: { aliases: ['hba1c', 'hemoglobin a1c', 'haemoglobin a1c', 'a1c', 'glycated hemoglobin', 'hgb a1c'], excludes: [] },
  fasting_insulin: { aliases: ['fasting insulin', 'insulin', 'insulin fasting'], excludes: ['growth factor', 'igf', 'antibod', 'resistance', 'homa'] },
  triglycerides: { aliases: ['triglycerides', 'trigs', 'tg', 'triglyceride'], excludes: ['ratio'] },
  hdl: { aliases: ['hdl', 'hdl cholesterol', 'hdl-c'], excludes: ['non hdl', 'non-hdl', 'nonhdl', 'ratio', 'particle', 'hdl-p', 'size'] },
  hs_crp: { aliases: ['hs-crp', 'hscrp', 'hs crp', 'high sensitivity crp', 'c-reactive protein', 'crp', 'cardiac crp'], excludes: [] },
  homocysteine: { aliases: ['homocysteine', 'homocyst(e)ine', 'total homocysteine'], excludes: ['urine'] },
  egfr: { aliases: ['egfr', 'gfr', 'estimated gfr', 'gfr estimated', 'egfr non-african american', 'egfr creat'], excludes: [] },
  creatinine: { aliases: ['creatinine', 'serum creatinine', 'creatinine serum'], excludes: ['urine', 'ratio', 'clearance', 'egfr', 'kinase', '24 hour', '24-hour'] },
  albumin: { aliases: ['albumin', 'serum albumin', 'albumin serum'], excludes: ['urine', 'micro', 'ratio', 'globulin', 'prealbumin', 'creatinine'] },
  alt: { aliases: ['alt', 'alt (sgpt)', 'sgpt', 'alanine aminotransferase', 'alanine transaminase'], excludes: [] },
  rdw: { aliases: ['rdw', 'rdw-cv', 'red cell distribution width', 'red blood cell distribution width'], excludes: ['rdw-sd'] },
  wbc: { aliases: ['wbc', 'white blood cell count', 'white blood cells', 'white blood cell', 'leukocytes', 'leukocyte count'], excludes: ['urine', 'differential', 'esterase'] },
  vitamin_d_25oh: { aliases: ['vitamin d', '25-oh vitamin d', 'vitamin d 25 hydroxy', '25 hydroxyvitamin d', 'vit d', 'vitamin d3', 'vitamin d, 25-oh', '25-hydroxyvitamin d'], excludes: ['1,25', '1 25', 'dihydroxy'] },
  ferritin: { aliases: ['ferritin', 'serum ferritin'], excludes: [] },
  apob: { aliases: ['apob', 'apolipoprotein b', 'apo b', 'apolipoprotein b-100'], excludes: ['ratio', 'apoa', 'apo a'] },
  lpa: { aliases: ['lp(a)', 'lpa', 'lipoprotein a', 'lipoprotein(a)', 'lipoprotein (a)', 'lp a', 'lp (a)'], excludes: [] },
};

// Same normalisation as clinicalRules.js and the scorer (whole tokens, so "non-HDL
// cholesterol" never answers to "hdl"), with the comma kept for "vitamin d, 25-oh".
const normalizeName = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9()\s.,-]/g, ' ').replace(/\s+/g, ' ').trim();

function matchesAlias(normalized, alias) {
  const a = normalizeName(alias);
  if (normalized === a) return true;
  const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s(,])${escaped}($|[\\s),])`).test(normalized);
}

/** The matrix marker id a lab row's name refers to, or null. */
export function markerFor(name) {
  const n = normalizeName(name);
  if (!n) return null;
  // Longest alias wins, so "fasting insulin" is claimed before "insulin" could be.
  let best = null;
  for (const [id, { aliases, excludes }] of Object.entries(NAMES)) {
    if (excludes.some((x) => n.includes(normalizeName(x)))) continue;
    for (const a of aliases) {
      if (matchesAlias(n, a) && (!best || a.length > best.len)) best = { id, len: a.length };
    }
  }
  return best?.id || null;
}

/* ---------------- units ---------------- */

// Spellings of the SAME unit, never conversions. A value is only compared with a
// threshold written in the unit the lab printed; "K/uL" and "x10^9/L" are one unit
// typed two ways, but Lp(a) in nmol/L and Lp(a) in mg/dL are different quantities
// with no reliable conversion, so they stay apart.
const SAME_UNIT = {
  'x10^9/l': ['10^9/l', 'x10e9/l', '10e9/l', '10*9/l', 'x109/l', 'k/ul', 'k/mm3', 'x10^3/ul', '10^3/ul', 'x10e3/ul', '10e3/ul', '10*3/ul', 'x103/ul', 'thou/ul', 'th/mm3', 'x10(3)/ul', '10(3)/ul'],
  'ml/min/1.73m2': ['ml/min/1.73m^2', 'ml/min/1.73', 'ml/min/1.73sqm', 'ml/min/1.73msq', 'ml/min'],
  'uiu/ml': ['uu/ml', 'miu/l', 'mu/l'],
  'u/l': ['iu/l'],
  'ng/ml': ['ug/l'],
  'mg/l': ['ug/ml'],
  'umol/l': [],
  'mg/dl': [],
  'g/dl': [],
  '%': [],
};
const UNIT_OF = new Map(Object.entries(SAME_UNIT).flatMap(([canon, alts]) => [[canon, canon], ...alts.map((a) => [a, canon])]));

/** One spelling per unit: "µIU/mL" and "uIU/mL" are the same; "nmol/L" is not "mg/dL". */
export function canonUnit(unit) {
  let u = String(unit ?? '').trim().toLowerCase()
    .replace(/[µμ]/g, 'u').replace(/²/g, '2').replace(/mcmol/g, 'umol').replace(/mcg/g, 'ug')
    .replace(/[\s{}_]/g, '');
  if (!u) return '';
  if (u.startsWith('%')) u = '%'; // "% of total Hgb"
  return UNIT_OF.get(u) || u;
}

export const sameUnit = (a, b) => Boolean(canonUnit(a)) && canonUnit(a) === canonUnit(b);

/* ---------------- values, ranges, sex ---------------- */

const EPS = 1e-9;

/**
 * A lab value as a number. "<0.5" and ">1000" are reported limits: they are read as
 * just below and just above the printed number, so ">1000" ferritin crosses a "gt
 * 1000" bound and "<1.0" hs-CRP sits under a "lt 1.0" one.
 */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value ?? '').trim();
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return null;
  if (/^[<≤]/.test(s)) return n - EPS;
  if (/^[>≥]/.test(s)) return n + EPS;
  return n;
}

/** The limits printed on the member's own report: "0.57-1.00", "<1.10", ">39". */
export function parseLabRange(range) {
  const text = String(range ?? '');
  const span = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (span) return { low: Number(span[1]), high: Number(span[2]) };
  const under = text.match(/[<≤]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (under) return { low: null, high: Number(under[1]) };
  const over = text.match(/[>≥]\s*=?\s*(-?\d+(?:\.\d+)?)/);
  if (over) return { low: Number(over[1]), high: null };
  return { low: null, high: null };
}

export function canonSex(sex) {
  const s = String(sex ?? '').trim().toLowerCase();
  if (/^(m|male|man)$/.test(s)) return 'male';
  if (/^(f|female|woman|w)$/.test(s)) return 'female';
  return null;
}

const BOUNDS = ['gt', 'gte', 'lt', 'lte'];
const CMP = { gt: (v, b) => v > b, gte: (v, b) => v >= b, lt: (v, b) => v < b, lte: (v, b) => v <= b };

/** Every bound in a rule holds. A "lab_high" bound with no printed range cannot hold. */
function withinBounds(rule, value, range) {
  let any = false;
  for (const k of BOUNDS) {
    if (!(k in rule)) continue;
    let b = rule[k];
    if (b === 'lab_high') b = range.high;
    else if (b === 'lab_low') b = range.low;
    if (typeof b !== 'number' || !Number.isFinite(b)) return false;
    if (!CMP[k](value, b)) return false;
    any = true;
  }
  return any;
}

/** The matrix's self range, for this member's sex. null when it can't be read. */
function selfRangeFor(def, sex) {
  const r = def.self_range;
  if (!r) return null;
  if ('male' in r || 'female' in r) return sex ? r[sex] || null : null;
  return r;
}

/* ---------------- one finding → one lane ---------------- */

const fmtValue = (v, unit) => `${v}${unit ? (unit === '%' ? '%' : ` ${unit}`) : ''}`;

/**
 * The lane for one reading.
 *
 * Provider rules are tried in the matrix's order and the first that matches wins.
 * A rule with `sex` applies to that sex only; when the member's sex is unknown it
 * still applies, so the lower of the two thresholds escalates rather than neither.
 * A `needs_trend` rule needs `previous`, the draw before this one, in the same unit
 * and higher than this value. No rule matching means the marker's default lane.
 *
 * @param {object} o
 * @param {string} o.marker     matrix id (see markerFor)
 * @param {*}      o.value      the lab's value, number or string ("<0.5")
 * @param {string} o.unit       the unit the lab printed
 * @param {string} [o.sex]      'male' | 'female' (any spelling canonSex reads)
 * @param {string} [o.labRange] the range printed on the report, for lab_high / lab_low
 * @param {object} [o.previous] { value, unit, date } the prior draw
 * @returns {null | object}     null for an unknown marker or a non-numeric value;
 *                              otherwise a card, with `lane: null` when the unit is not
 *                              the matrix's (the thresholds were not applied)
 */
export function laneFor({ marker, value, unit, sex, labRange, previous } = {}) {
  const def = MATRIX.markers[marker];
  if (!def) return null;
  const v = toNumber(value);
  if (v == null) return null;
  const who = canonSex(sex);
  const card = {
    marker,
    name: def.name,
    domain: def.domain,
    value: v,
    shown: fmtValue(String(value).trim(), unit || ''),
    unit: unit || '',
    lane: null,
    label: null,
    level: null,
    trigger: null,
    why: '',
    rule: null,
    inSelfRange: null,
    watch: (def.conditions || []).map((c) => `${c.trigger}: ${c.when}`),
  };

  if (!sameUnit(unit, def.unit)) {
    // The thresholds are written in the matrix's unit and are never converted. A
    // marker that is provider-only whatever its value (Lp(a), ESC-06) still routes
    // to the provider; everything else is left unrouted.
    if (def.default_lane === 'provider' && !def.self_range) {
      return {
        ...card, lane: 'provider', label: MATRIX.lanes.provider, level: 'flag', trigger: 'ESC-06',
        why: (def.conditions || []).find((c) => c.trigger === 'ESC-06')?.when || 'Provider-only marker.',
        thresholdsApplied: false,
        note: `Reported in ${unit || 'no unit'}; the matrix thresholds are in ${def.unit} and are not converted.`,
      };
    }
    return { ...card, unmatched: 'unit', note: `Reported in ${unit || 'no unit'}; the matrix is written in ${def.unit}, so no lane was assigned.` };
  }

  const range = parseLabRange(labRange);
  const self = selfRangeFor(def, who);
  card.inSelfRange = self ? withinBounds(self, v, range) : null;

  for (const [i, rule] of (def.provider || []).entries()) {
    if (rule.sex && who && rule.sex !== who) continue;
    if (!withinBounds(rule, v, range)) continue;
    if (rule.needs_trend) {
      const pv = previous ? toNumber(previous.value) : null;
      if (pv == null || !sameUnit(previous.unit, def.unit) || !(pv > v)) continue;
      card.previous = { value: pv, shown: fmtValue(String(previous.value).trim(), previous.unit || ''), date: previous.date || null };
    }
    return {
      ...card, lane: 'provider', label: MATRIX.lanes.provider, level: rule.level,
      trigger: rule.needs_trend ? 'ESC-02' : 'ESC-01', why: rule.why, rule: i,
      ...(rule.sex && !who ? { note: `Sex not on file; the ${rule.sex} threshold was applied.` } : {}),
    };
  }

  const lane = def.default_lane;
  return {
    ...card, lane, label: MATRIX.lanes[lane],
    ...(lane === 'provider' ? { level: 'flag', trigger: 'ESC-06', why: (def.conditions || []).find((c) => c.trigger === 'ESC-06')?.when || 'Provider-only marker.' } : {}),
  };
}

/* ---------------- the whole record ---------------- */

// Sortable draw date, as everywhere else in the app: `date` is a display string.
const drawnAt = (lab) => String(lab?.drawnOn || lab?.created_at || lab?.date || '');
const shownDate = (lab) => lab?.date || (lab?.drawnOn ? String(lab.drawnOn).slice(0, 10) : null);

/** Lab rows grouped by matrix marker, numeric only, newest draw first. */
function byMarker(labs) {
  const groups = new Map();
  for (const lab of labs || []) {
    const id = markerFor(lab?.name);
    if (!id || toNumber(lab.value) == null) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(lab);
  }
  for (const rows of groups.values()) rows.sort((a, b) => drawnAt(b).localeCompare(drawnAt(a)));
  return groups;
}

/**
 * A lane card for every matrix marker on file, from its newest reading. The prior
 * draw (an earlier date, not a re-upload of the same one) goes along as `previous`
 * for the trend rule.
 *
 * @returns {object[]} cards, provider lane first (immediate before flag)
 */
export function lanesFor(labs, { sex, now = Date.now() } = {}) {
  const cards = [];
  for (const [marker, rows] of byMarker(labs)) {
    const [latest] = rows;
    const prior = rows.find((r) => drawnAt(r) && drawnAt(r) !== drawnAt(latest));
    const card = laneFor({
      marker, value: latest.value, unit: latest.unit, sex, labRange: latest.range,
      previous: prior ? { value: prior.value, unit: prior.unit, date: shownDate(prior) } : undefined,
    });
    if (card) cards.push({ ...card, date: shownDate(latest), age: describeLabAge(latest, now), source: latest.source || null, labName: latest.name });
  }
  const rank = (c) => (c.lane === 'provider' ? (c.level === 'immediate' ? 0 : 1) : c.lane === 'self' ? 2 : 3);
  return cards.sort((a, b) => rank(a) - rank(b));
}

/* ---------------- Section 9: emergency overrides ---------------- */

// The same freshness line clinicalRules.js draws for urgent values: a critical
// reading older than this is "ask for a repeat", not "go now".
const EMERGENCY_MAX_AGE_DAYS = 90;

/**
 * Section 9 overrides on the newest reading of each marker, in the unit the rule is
 * written in. A hit drawn in the last 90 days is `fresh` and bypasses the lanes and
 * the agents; an older or undated one is returned with `fresh: false`, to be raised
 * as a recheck rather than an emergency.
 *
 * @returns {object[]} [{ marker, name, value, shown, unit, date, rule, fresh, ageDays }]
 */
export function emergencyFor(labs, { now = Date.now() } = {}) {
  const groups = byMarker(labs);
  const hits = [];
  for (const rule of MATRIX.emergency.rules) {
    const latest = groups.get(rule.marker)?.[0];
    if (!latest || !sameUnit(latest.unit, rule.unit)) continue;
    const v = toNumber(latest.value);
    if (!withinBounds(rule, v, { low: null, high: null })) continue;
    const age = describeLabAge(latest, now);
    hits.push({
      marker: rule.marker,
      name: MATRIX.markers[rule.marker]?.name || rule.marker,
      value: v,
      shown: fmtValue(String(latest.value).trim(), latest.unit),
      unit: latest.unit,
      date: shownDate(latest),
      rule: BOUNDS.filter((k) => k in rule).map((k) => `${k} ${rule[k]} ${rule.unit}`).join(', '),
      fresh: age.days != null && age.days <= EMERGENCY_MAX_AGE_DAYS,
      ageDays: age.days,
    });
  }
  return hits;
}

/**
 * The hard-coded Section 9 message: no model writes it. It names the values and
 * dates and says what to do, and nothing else (no diagnosis, no medication).
 */
export function emergencyMessage(hits) {
  const list = hits.map((h) => `- **${h.name} ${h.shown}**${h.date ? ` (drawn ${h.date})` : ''}`).join('\n');
  return `**Some of your results need prompt medical attention.**

${list}

${hits.length > 1 ? 'These values are' : 'This value is'} outside the range where we can guide you here. Please contact your provider's office today, or go to urgent care. If you feel very unwell, call 911 or go to the nearest emergency room.

Take this result with you, and ask for it to be reviewed and repeated.`;
}

/* ---------------- what compose is handed ---------------- */

const cardLine = (c) => {
  const old = c.age?.tier === 'historical' ? `, ${c.age.label}: HISTORICAL, repeat before acting on it`
    : c.age?.tier === 'stale' ? `, ${c.age.label}: stale, say so` : c.age?.tier === 'undated' ? ', no draw date on file' : '';
  const when = c.date || old ? ` (${[c.date, old.replace(/^, /, '')].filter(Boolean).join(', ')})` : '';
  const trend = c.previous ? `, down from ${c.previous.shown}${c.previous.date ? ` (${c.previous.date})` : ''}` : '';
  if (c.lane === 'provider') return `- ${c.name} ${c.shown}${when}${trend}: ${c.level === 'immediate' ? 'IMMEDIATE' : 'flag'}. ${c.why}${c.note ? ` ${c.note}` : ''}`;
  if (c.lane === 'self') return `- ${c.name} ${c.shown}${when}: ${c.inSelfRange === true ? "inside Thumbprint's self-lane range" : c.inSelfRange === false ? "outside Thumbprint's self-lane range, but below every provider threshold" : 'below every provider threshold'}.`;
  return `- ${c.name} ${c.shown}${when}: ${c.note}`;
};

/** The lane cards as the block compose reads. Empty string when nothing is on file. */
export function laneBlock(cards) {
  if (!cards?.length) return '';
  const provider = cards.filter((c) => c.lane === 'provider');
  const self = cards.filter((c) => c.lane === 'self');
  const unrouted = cards.filter((c) => !c.lane);
  return `## Routing lanes (set in code from the escalation matrix; final)
Every marker below already has its lane. When you mention one of these markers, put it in this lane:
- A "Bring this to your provider" marker goes under that heading, never under "What you can do". IMMEDIATE means the member should arrange a provider evaluation soon; say so plainly. flag means raise it at the next visit.
- A "You can act on this" marker may go under "What you can do". Never move it to the provider list on your own reading of the number; a specialist's reason (a medication, a symptom) can add a provider item, but the marker's lane stays.
- Unrouted markers have no lane. Do not assign one.
${provider.length ? `\n### Bring this to your provider\n${provider.map(cardLine).join('\n')}` : ''}${self.length ? `\n### You can act on this\n${self.map(cardLine).join('\n')}` : ''}${unrouted.length ? `\n### Unrouted\n${unrouted.map(cardLine).join('\n')}` : ''}`;
}
