// Record reviews: the team reads the member's whole record with no question asked,
// and writes what a screen shows. Since Oct 21 2026 every recommendation the app
// shows comes from the team: the Home, Records and Labs insight cards ("insights")
// and the visit-prep page ("discussion") used to be single prompts in the browser.
//
//   1. code      lanes from the escalation matrix, plus the GLP-1 label card
//   2. team      every specialist whose area the record has data in (no router: a
//                review covers the whole record, so who reads is decided by what is
//                on file), each reviewing the record from its side, in parallel
//   3. huddle    each reads the others and sends one note
//   4. compose   the Advocate writes the screen's JSON (briefs/advocate-cards,
//                briefs/advocate-visit)
//   5. safety    the fact-checker reads it against the record; the code rules
//                (forbidden output, dose-change talk, number trace) run on every
//                field; one revision for anything flagged; whatever still fails is
//                dropped, never shown
//
// Same shared rules, Dr. Locker's rules, library and logs as a chat question.
import { complete, parseJson } from './llm.mjs';
import { systemFor } from './config.mjs';
import { lanesFor, laneBlock } from './escalation.mjs';
import { violatesForbiddenOutput, hasFunctionalConcern, URGENCY_RULES } from '../../src/lib/clinicalRules.js';
import { untracedNumbers } from '../../src/lib/numberTrace.js';
import { glp1Eligibility, glp1LaneCard } from '../../src/lib/glp1.js';
import {
  TEAM, factsFor, research, confer, consensusOf, factCheck, noteSafety, findingsText, checkKeysFor, clip, quoted,
} from './team.mjs';

/* ---------------- who reads ---------------- */

const has = (facts, key) => {
  const body = (facts?.sections || []).find((s) => s.key === key)?.body;
  return Boolean(body && String(body).trim() && !/^\(none recorded\)$/i.test(String(body).trim()));
};
const text = (facts, key) => String((facts?.sections || []).find((s) => s.key === key)?.body || '');
const HORMONE_MARKERS = /\b(tsh|free t4|free t3|t4|t3|thyroid|testosterone|estradiol|shbg|progesterone|fsh|lh|dhea|cortisol|prolactin)\b/i;
const HORMONE_INTAKE = /menopaus|perimenopaus|low testosterone|trt|hormone therapy|hrt\b|thyroid/i;
const METABOLIC_MARKERS = /\b(glucose|a1c|hba1c|insulin|triglycerides?|hdl|alt|uric acid)\b/i;
const METABOLIC_INTAKE = /diabet|insulin resistance|high blood pressure|hypertension|high cholesterol|dyslipid|fatty liver/i;

/**
 * The specialists a review consults: every one whose area the record holds data in.
 * General always reads the preventive schedule when there is one; with nothing
 * measured on file it reads alone, and the cards are about getting the first data.
 */
export function reviewersFor(facts, { firstData = false } = {}) {
  if (firstData) return ['general'];
  const ids = [];
  if (has(facts, 'labs')) ids.push('bloodwork');
  if (has(facts, 'bioAge') && !/^- Not calculated/.test(text(facts, 'bioAge').trim())) ids.push('bioage');
  if (HORMONE_MARKERS.test(text(facts, 'labs')) || HORMONE_INTAKE.test(`${text(facts, 'intake')} ${text(facts, 'medications')}`)) ids.push('hormones');
  if (has(facts, 'medications')) ids.push('medications');
  if (has(facts, 'genetics') || has(facts, 'geneticDocuments')) ids.push('genetics');
  if (['wearableToday', 'wearableHistory', 'checkIns'].some((k) => has(facts, k))) ids.push('lifestyle');
  if (/Height|Current weight|Waist/.test(text(facts, 'weight'))) ids.push('weight');
  if (METABOLIC_MARKERS.test(text(facts, 'labs')) || METABOLIC_INTAKE.test(text(facts, 'intake'))) ids.push('metabolism');
  if (has(facts, 'preventive')) ids.push('general');
  return ids.length ? ids : ['general'];
}

/* ---------------- the tasks ---------------- */

const TASKS = {
  insights: {
    label: 'insights',
    ask: 'Review my member\'s whole record from your side. What are the one or two findings that matter most right now, with values and dates, how current they are, and what goes in each lane?',
    brief: 'advocate-cards',
    maxTokens: 1800,
  },
  discussion: {
    label: 'discussion',
    ask: 'My member has an appointment coming up. From your side, what should they raise: the results that matter with values and dates, anything in the provider lane, and the specific tests to ask for?',
    brief: 'advocate-visit',
    maxTokens: 900,
  },
};

// The insight cards' own rule (src/lib/aiInsights.js before this moved here): a card
// that floats a dose or medication change, even with no number in it, is not shown.
const DOSE_CHANGE_TALK = /\b(?:dos(?:e|age|ing)s?|medications?|prescriptions?)\s+(?:\w+\s+)?(?:adjust|chang|increas|decreas|tweak|modif|titrat)\w*|\b(?:adjust|chang|increas|decreas|rais|lower|tweak|modif|titrat|optimi[sz])\w*\s+(?:(?:your|the|their|a|any)\s+)?(?:\w+\s+)?(?:dos(?:e|age|ing)s?|medications?|prescriptions?)\b/i;

/** Each piece of the screen's JSON a member reads, as [path, text], so each can be checked and dropped alone. */
function pieces(task, out) {
  if (!out || typeof out !== 'object') return [];
  const join = (o, fields) => fields.map((f) => o?.[f]).filter(Boolean).join('\n');
  if (task === 'insights') {
    return [
      out.daily ? ['daily', join(out.daily, ['title', 'body', 'basis'])] : null,
      out.record ? ['record', join(out.record, ['title', 'system', 'body', 'basis', 'doctorPath', 'selfPayPath'])] : null,
      ...(Array.isArray(out.labs) ? out.labs.map((l, i) => [`labs.${i}`, join(l, ['title', 'body', 'basis'])]) : []),
    ].filter(Boolean);
  }
  return [
    out.summary ? ['summary', String(out.summary)] : null,
    ...(Array.isArray(out.questions) ? out.questions.map((q, i) => [`questions.${i}`, String(q || '')]) : []),
  ].filter(Boolean);
}

function drop(task, out, paths) {
  const gone = new Set(paths);
  if (task === 'insights') {
    return {
      daily: gone.has('daily') ? null : out.daily || null,
      record: gone.has('record') ? null : out.record || null,
      labs: (Array.isArray(out.labs) ? out.labs : []).filter((_, i) => !gone.has(`labs.${i}`)).slice(0, 3),
    };
  }
  return {
    summary: gone.has('summary') ? null : out.summary || null,
    questions: (Array.isArray(out.questions) ? out.questions : []).filter((_, i) => !gone.has(`questions.${i}`)).slice(0, 4),
  };
}

/** What breaks a rule, per piece: the forbidden list, dose-change talk, and numbers with no source. */
function codeFlags(task, out, { functional, traceSource }) {
  const flags = [];
  for (const [path, body] of pieces(task, out)) {
    const why = violatesForbiddenOutput(body, { hasFunctionalConcern: functional })
      || (DOSE_CHANGE_TALK.test(body) ? 'a hint that a dose or medication may change' : null);
    if (why) flags.push({ path, kind: 'rule', problem: why, excerpt: body });
    const stray = untracedNumbers(body, traceSource);
    if (stray.length) flags.push({ path, kind: 'number', problem: `numbers not in the record or the library (${stray.join(', ')})`, excerpt: stray.join(', ') });
  }
  return flags;
}

const asText = (task, out) => pieces(task, out).map(([p, t]) => `[${p}]\n${t}`).join('\n\n');

/* ---------------- the review ---------------- */

/**
 * @param {object} o
 * @param {'insights'|'discussion'} o.task
 * @param {object} o.facts       { preamble, sections } from buildFactSections
 * @param {object} o.healthData  { labs, sex, score, intake } for lanes and the code checks
 * @param {object} [o.extras]    computed in the app: { targets, conversation, breadth, freshness, urgent[], recheck[], firstData }
 * @param {object} o.run         { auth, ledger, safety }
 * @param {Function} [send]      receives progress events
 */
export async function runReview({ task, facts, healthData = {}, extras = {}, run }, send = () => {}) {
  const spec = TASKS[task];
  if (!spec) throw new Error(`Unknown review: ${task}`);
  const started = Date.now();
  const emit = (e) => send({ ...e, t: Date.now() - started });

  const glp1Card = glp1LaneCard(glp1Eligibility(healthData.intake || {}, healthData.sex));
  const lanes = [...(glp1Card ? [glp1Card] : []), ...lanesFor(healthData.labs, { sex: healthData.sex })];
  const ids = reviewersFor(facts, { firstData: Boolean(extras.firstData) });
  const question = `[${spec.label}] ${spec.ask}`;
  const extraBlock = [
    extras.targets ? `## Thumbprint targets (the target the member sees beside each lab range; the only targets you may cite)\n${extras.targets}` : '',
    extras.conversation ? `## What the member has told us (their own messages, oldest first: longitudinal data, weighted by how often it recurs)\n${extras.conversation}` : '',
    extras.breadth ? `## What this member has on file\n${extras.breadth}` : '',
    extras.freshness ? `## Data age (the newest reading is the fact; over 12 months is history)\n${extras.freshness}` : '',
    extras.urgent?.length ? `## Urgent patterns already shown to the member (do not repeat, soften or contradict them)\n${extras.urgent.map((u) => `- ${u}`).join('\n')}\n\n${URGENCY_RULES}` : '',
    extras.recheck?.length ? `## Out-of-range results too old to be urgent (the member sees a calm "worth repeating" note; never describe them as current)\n${extras.recheck.map((u) => `- ${u}`).join('\n')}` : '',
    extras.firstData ? '## FIRST DATA ONLY\nNo bloodwork, no wearable and no readable report on file. Write nothing about a condition, a risk or a likely cause; every item is about getting their first data.' : '',
  ].filter(Boolean).join('\n\n');

  // 2. Every specialist with data to read, at once.
  emit({ type: 'route_done', reason: 'Your whole record, reviewed by every specialist with data to read.', consult: ids.map((id) => ({ id, ask: spec.ask })), parallel: true });
  const reads = {};
  const sources = [];
  const libraryText = [];
  await Promise.all(ids.map(async (id) => {
    emit({ type: 'specialist_start', id, ask: spec.ask });
    try {
      const r = await research({ id, ask: spec.ask, question, facts, run, context: extraBlock });
      if (!r.read) throw new Error('empty report');
      reads[id] = r.read;
      sources.push(...r.sources.map((s) => ({ ...s, readBy: id })));
      libraryText.push(r.library || '');
      emit({ type: 'specialist_done', id, headline: r.headline, finding: r.finding, flag: r.flag });
    } catch (err) {
      console.log(`[review:${task}:${id}] failed: ${err.message}`);
      emit({ type: 'specialist_done', id, headline: "Couldn't report this time", finding: '', flag: 'ok', failed: true });
    }
  }));
  const ordered = Object.fromEntries(ids.filter((id) => reads[id]).map((id) => [id, reads[id]]));
  if (!Object.keys(ordered).length) throw new Error('No specialist could report.');
  if (run) run.routing = { path: 'team', specialists: Object.keys(ordered), general: 'general' in ordered, fallback: false, topic: `review: ${task}` };

  // 3. Huddle.
  let notes = [];
  let consensus = '';
  if (Object.keys(ordered).length > 1) {
    const got = await Promise.all(Object.keys(ordered).map((id) => confer({ id, reads: ordered, run }).catch(() => null)));
    notes = got.filter(Boolean);
    consensus = await consensusOf({ notes, run }).catch(() => '');
  }

  // 4. Compose the screen.
  const keys = checkKeysFor(Object.keys(ordered));
  const record = factsFor(facts, [...new Set([...keys, 'weight'])]);
  const lanesText = laneBlock(lanes);
  const brief = `${record}\n\n${findingsText(ordered, notes, consensus)}${lanesText ? `\n\n${lanesText}` : ''}${extraBlock ? `\n\n${extraBlock}` : ''}`;
  const raw = await complete({
    system: systemFor(spec.brief),
    user: `${brief}\n\nWrite the ${task === 'insights' ? 'insight cards' : 'visit-prep page'} now. JSON only.`,
    tier: 'smart', maxTokens: spec.maxTokens, temperature: 0.3, label: `compose:${task}`, run,
  });
  let out = parseJson(raw);
  if (!out) throw new Error('The team returned no readable page.');

  // 5. Safety: the fact-checker and the code rules, one revision, then drop.
  const traceSource = [record, ...libraryText, lanesText, extraBlock].join('\n');
  const functional = hasFunctionalConcern(healthData);
  const check = await factCheck({ answer: asText(task, out), facts, reads: ordered, sources, run }).catch(() => ({ clean: true, flags: '' }));
  let flags = codeFlags(task, out, { functional, traceSource });
  if (!check.clean) noteSafety(run, { kind: 'fact_check', rule: `[review:${task}] ${check.flags}`, excerpt: quoted(check.flags) || asText(task, out) });
  for (const f of flags) noteSafety(run, { kind: f.kind === 'number' ? 'fact_check' : 'rule_rewrite', rule: `[review:${task}] ${f.path}: ${f.problem}`, excerpt: clip(f.excerpt, 400) });

  if (!check.clean || flags.length) {
    const list = [check.clean ? '' : check.flags, ...flags.map((f) => `${f.path}: ${f.problem}`)].filter(Boolean).join('\n');
    const fixed = parseJson(await complete({
      system: systemFor(spec.brief),
      user: `${brief}\n\n## Your draft\n${JSON.stringify(out)}\n\n## Flagged\n${list}\n\nFix every flag and change nothing else. Remove a number that is not in the record rather than guess one. Return the full JSON only.`,
      tier: 'smart', maxTokens: spec.maxTokens, temperature: 0.2, label: `revise:${task}`, run,
    }).catch(() => ''));
    if (fixed) out = fixed;
    flags = codeFlags(task, out, { functional, traceSource });
    if (flags.length) {
      for (const f of flags) noteSafety(run, { kind: 'rule_scrub', rule: `[review:${task}] ${f.path} dropped: ${f.problem}`, excerpt: clip(f.excerpt, 400) });
      out = drop(task, out, flags.map((f) => f.path));
    }
  }

  return { ...drop(task, out, []), lanes, routing: run?.routing || null, seconds: Math.round((Date.now() - started) / 1000) };
}
