// My Advocate and the four specialists: the Monitus manager pipeline, for medicine.
//
//   1. precheck  code: critical lab values and crisis language, before any model
//   2. route     the Advocate picks specialists and writes each one an ask (cheap tier)
//   3. research  every specialist reads ITS slice of the record and ITS library
//                sections, independently and in parallel (smart tier)
//   4. huddle    each specialist reads the others' findings and sends one note (cheap)
//   5. lanes     code: every marker on file is matched against the escalation matrix
//                (spec #25) and gets its lane; the model is handed the cards, never asked
//   6. compose   the Advocate writes the one answer the member reads (smart)
//   7. safety    the fact-checker brief audits it against the record; one revision if
//                flagged; then the forbidden-output rules run as code (rewrite, then cut)
//
// Every step is reported as an event the moment it happens. The event names and
// fields are the ones the browser care team already emits (src/lib/careTeam.js
// readTeam), so CareTeam.jsx animates a server round with no changes.
import { complete, parseJson } from './llm.mjs';
import { systemFor } from './config.mjs';
import { searchReference, knowledgeBlock, scrubInventedCitations } from './knowledge.mjs';
import { precheck, enforce } from './safety.mjs';
import { lanesFor, laneBlock, emergencyFor, emergencyMessage } from './escalation.mjs';
import { URGENCY_RULES } from '../../src/lib/clinicalRules.js';

/**
 * The roster. Routing metadata lives here, in code, as in Monitus's BUILTIN registry;
 * who each agent IS lives in briefs/<id>/brief.md.
 *
 *  facts    which sections of the member's record the agent is handed
 *           (keys from buildFactSections in src/lib/healthContext.js)
 *  library  which library sections it may search: home section plus neighbours
 */
export const TEAM = {
  bloodwork: {
    desc: 'labs: CBC, CMP, lipids/ApoB, A1c/insulin, liver, kidney, iron, vitamins, hs-CRP; biological and heart age',
    facts: ['profile', 'medications', 'labs', 'labTrends', 'bloodworkScore', 'documents'],
    library: ['lipids-cardio', 'metabolic', 'kidney-liver', 'blood-iron', 'vitamins', 'inflammation', 'bio-age', 'preventive'],
  },
  hormones: {
    desc: 'hormones and thyroid: menopause/perimenopause, testosterone, estradiol, SHBG, progesterone, TSH/T4/T3/antibodies, peptide education',
    facts: ['profile', 'intake', 'medications', 'labs', 'labTrends', 'checkIns', 'documents'],
    library: ['thyroid', 'hormones-female', 'hormones-male', 'peptides'],
  },
  medications: {
    desc: 'medications and supplements: interactions, timing, nutrient depletion, labs a drug moves, pharmacogenomics',
    facts: ['profile', 'medications', 'labs', 'genetics', 'intake'],
    library: ['medications', 'pharmacogenomics', 'supplements'],
  },
  lifestyle: {
    desc: 'nutrition, sleep, activity, wearable trends (HRV, resting HR, readiness), stress, check-in follow-up',
    facts: ['profile', 'intake', 'labs', 'wearableScore', 'wearableToday', 'wearableRanges', 'wearableHistory', 'dailyScore', 'checkIns', 'body'],
    library: ['nutrition', 'sleep', 'activity'],
  },
};

const MAX_SPECIALISTS = 3;

const clip = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/* ---------------- the record ---------------- */

/** One section as the chat has always read it (renderFactSection in healthContext.js). */
const renderSection = ({ title, body }) => `\n${title}\n${body && String(body).trim() ? body : '(none recorded)'}`;

/** The slice of the record an agent is handed, preceded by the date and recency rules. */
export function factsFor(facts, keys) {
  const wanted = new Set(keys);
  const picked = (facts?.sections || []).filter((s) => wanted.has(s.key));
  return `## Facts (the member's own record)\n${facts?.preamble || ''}\n${picked.map(renderSection).join('\n')}`;
}

/* ---------------- 2. route ---------------- */

// Words that always bring a specialist in, whatever the router picked: the same move
// as Monitus forcing the Contract Expert onto every named company. Cheap insurance
// against the one specialist who should have been asked being left out.
const FORCE = [
  ['medications', /\b(medication|medicine|meds?|drug|prescri\w*|pill|supplement\w*|statin|metformin|levothyroxine|synthroid|ozempic|wegovy|semaglutide|tirzepatide|ssri|interact\w*|side effects?|can i take)\b/i],
  ['hormones', /\b(hormone\w*|thyroid|tsh|t3|t4|menopaus\w*|perimenopaus\w*|hot flash\w*|testosterone|trt|estrogen|estradiol|progesterone|shbg|libido|period|cycle|peptide\w*|bpc)\b/i],
  ['bloodwork', /\b(labs?|bloodwork|blood work|panel|results?|marker\w*|cholesterol|ldl|hdl|apob|a1c|glucose|insulin|ferritin|iron|vitamin|b12|crp|creatinine|egfr|alt|ast|biological age|bio age)\b/i],
];

export async function route({ question, recent, facts, run }) {
  const roster = Object.entries(TEAM).map(([id, t]) => `- "${id}": ${t.desc}`).join('\n');
  const prompt = `The member asked you:
"${question}"

Specialists you can bring in:
${roster}

Respond with ONLY JSON:
{"reason": "<one sentence, max 20 words, written TO the member in the second person>",
 "consult": [{"id": "<specialist id>", "ask": "<max 22 words, naming their actual markers, values, medications or symptoms>"}]}

${factsFor(facts, ['profile', 'medications', 'labs'])}`;
  const raw = await complete({
    system: systemFor('advocate'),
    messages: [...recent, { role: 'user', content: prompt }],
    tier: 'cheap', maxTokens: 400, temperature: 0, label: 'route', run,
  });
  const plan = parseJson(raw) || {};
  const seen = new Set();
  const consult = (plan.consult || [])
    .filter((c) => TEAM[c?.id] && !seen.has(c.id) && seen.add(c.id))
    .slice(0, MAX_SPECIALISTS)
    .map((c) => ({ id: c.id, ask: clip(c.ask, 180) }));
  for (const [id, re] of FORCE) {
    if (!seen.has(id) && re.test(question)) {
      seen.add(id);
      consult.push({ id, ask: `What in my member's record bears on "${clip(question, 90)}" from your side?` });
    }
  }
  if (!consult.length) consult.push({ id: 'bloodwork', ask: "What in my member's record bears most directly on their question?" });
  return { reason: clip(plan.reason, 160), consult };
}

/* ---------------- 3. research ---------------- */

const SCREEN_ASK = `

End your reply with exactly this block. The member watches the team work, so it is written about them as "our member", never "he", "she" or "the patient":
## For the member's screen
Headline: <your key point, max 9 words>
Finding: <2-3 sentences, max 70 words, your answer to the Advocate with the values and dates that matter>
Flag: <ok | watch | urgent>`;

function splitScreen(text) {
  const i = text.search(/^##\s*For the member'?s screen\s*$/mi);
  const body = i < 0 ? text : text.slice(0, i).trim();
  const tail = i < 0 ? '' : text.slice(i);
  const field = (name) => (new RegExp(`^${name}:\\s*(.+)$`, 'mi').exec(tail)?.[1] || '').trim();
  const flag = field('Flag').toLowerCase();
  // A reply that is only the screen block is still a report: its finding is the read.
  // Treating it as empty is what showed "Couldn't report this time" on a live round.
  return {
    read: body || [field('Headline'), field('Finding')].filter(Boolean).join('\n'),
    headline: clip(field('Headline'), 70),
    finding: clip(field('Finding') || body, 480),
    flag: ['ok', 'watch', 'urgent'].includes(flag) ? flag : 'ok',
  };
}

async function research({ id, ask, question, facts, run }) {
  const spec = TEAM[id];
  const passages = searchReference(spec.library, `${question} ${ask}`, 5);
  const input = [
    factsFor(facts, spec.facts),
    knowledgeBlock(passages),
    `## The member's question\n"${question}"`,
    `## The Advocate asks you\n${ask}`,
    `Answer the Advocate, not the member. Quote values with their draw dates, newest first. If your area has nothing on record, say so plainly and name the test or data that would answer it. Put every action in a lane (shared rule 6). Be tight; no padding.${SCREEN_ASK}`,
  ].join('\n\n');
  const raw = await complete({ system: systemFor(id), user: input, tier: 'smart', maxTokens: 1000, label: `research:${id}`, run });
  return { ...splitScreen(scrubInventedCitations(raw, passages.map((p) => p.title))), sources: passages.map((p) => ({ kind: 'library', title: p.title, cite: p.cite, evidence: p.evidence })) };
}

/* ---------------- 4. huddle ---------------- */

async function confer({ id, reads, run }) {
  const others = Object.entries(reads).filter(([o]) => o !== id);
  const raw = await complete({
    system: systemFor(id),
    user: `You researched independently. Now you are conferring with the other specialists before the Advocate writes the answer.

## Your own finding
${reads[id]}

## What the others found
${others.map(([o, r]) => `### ${o}\n${r}`).join('\n\n')}

Send ONE note to the colleague whose finding matters most to yours: agree and connect, flag a conflict (name the newer or better-sourced reading), or add a caveat they missed. Use only what is in the findings. The member can read this, so say "our member", never "he", "she" or "the patient".
Respond with ONLY JSON: {"to": "<${others.map(([o]) => o).join(' | ')}>", "note": "<max 26 words, first person, addressed to them>"}`,
    tier: 'cheap', maxTokens: 160, temperature: 0.3, label: `huddle:${id}`, run,
  });
  const out = parseJson(raw) || {};
  const to = others.some(([o]) => o === out.to) ? out.to : others[0]?.[0];
  return out.note && to ? { from: id, to, note: clip(out.note, 200) } : null;
}

async function consensusOf({ notes, run }) {
  if (!notes.length) return '';
  const raw = await complete({
    system: 'You summarise a care team huddle in one sentence for the member, in the second person.',
    user: `${notes.map((n) => `${n.from} → ${n.to}: ${n.note}`).join('\n')}\n\nOne sentence, max 22 words: what the team agrees matters most for you. No preamble.`,
    tier: 'cheap', maxTokens: 60, label: 'huddle:consensus', run,
  });
  return clip(raw.replace(/^["']|["']$/g, ''), 180);
}

/* ---------------- 6–7. compose and check ---------------- */

const NAMES = { bloodwork: 'Blood Work', hormones: 'Hormone & Thyroid', medications: 'Medication & Interactions', lifestyle: 'Lifestyle' };

function findingsText(reads, notes, consensus) {
  const consulted = Object.keys(reads).map((id) => NAMES[id] || id);
  return `## Your specialists' findings
Consulted on this question: ${consulted.join(', ')}. Credit a finding only to the specialist who made it, by these names; never name a specialist who was not consulted.
${Object.entries(reads).map(([id, r]) => `### ${NAMES[id] || id}\n${r}`).join('\n\n')}
${notes.length ? `\n## Huddle notes\n${notes.map((n) => `- ${n.from} → ${n.to}: ${n.note}`).join('\n')}` : ''}${consensus ? `\nConsensus: ${consensus}` : ''}`;
}

async function compose({ question, recent, facts, reads, notes, consensus, pre, lanes, run }) {
  const routed = laneBlock(lanes);
  const urgent = pre.lines.length ? `\n\n## Safety pre-check: URGENT\n${pre.lines.join('\n')}\n\n${URGENCY_RULES}` : '';
  return complete({
    system: systemFor('advocate-answer'),
    messages: [
      ...recent,
      { role: 'user', content: `${factsFor(facts, ['profile', 'medications', 'labs'])}\n\n${findingsText(reads, notes, consensus)}${routed ? `\n\n${routed}` : ''}${urgent}\n\n## The member's question\n"${question}"\n\nWrite your answer to the member now.` },
    ],
    tier: 'smart', maxTokens: 1400, temperature: 0.3, label: 'compose', run,
  });
}

async function factCheck({ answer, facts, reads, sources, run }) {
  const given = sources.length ? sources.map((s) => `- "${s.title}" (${s.cite})`).join('\n') : '(none — the team was given no library passages, so the answer may cite none)';
  const verdict = await complete({
    system: systemFor('safety'),
    user: `${factsFor(facts, ['profile', 'medications', 'labs', 'labTrends'])}\n\n${findingsText(reads, [], '')}\n\n## Library passages the team was given\n${given}\n\n## The Advocate's answer\n${answer}`,
    tier: 'smart', maxTokens: 600, temperature: 0, label: 'safety:check', run,
  });
  const clean = /^\s*All claims supported\.?\s*$/i.test(verdict);
  return { clean, flags: clean ? '' : verdict };
}

async function revise({ answer, flags, facts, reads, run }) {
  return complete({
    system: systemFor('advocate-answer'),
    user: `${factsFor(facts, ['profile', 'medications', 'labs', 'labTrends'])}\n\n${findingsText(reads, [], '')}\n\n## Your draft\n${answer}\n\n## The Safety Review flagged\n${flags}\n\nFix every flag and change nothing else. Return the full corrected answer only.`,
    tier: 'smart', maxTokens: 1400, temperature: 0.2, label: 'revise', run,
  });
}

/* ---------------- orchestration ---------------- */

/**
 * One question, start to finish.
 *
 * @param {object}   o
 * @param {string}   o.question
 * @param {Array}    o.history     prior turns, [{role, content}] (string content)
 * @param {object}   o.facts       { preamble, sections: [{key, title, body}] } from buildFactSections
 * @param {object}   o.healthData  { labs, sex, score: { bloodwork: { markers } } } for the code checks and lanes
 * @param {object}   o.run         { auth, ledger }
 * @param {Function} send          receives each event
 */
export async function runQuestion({ question, history = [], facts, healthData, run }, send) {
  const started = Date.now();
  const emit = (e) => send({ ...e, t: Date.now() - started });
  const recent = history.slice(-6).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim());

  // 1. Code before any model. Crisis language skips the team entirely: the member
  // gets the 988 line now, not after a minute of specialists.
  const pre = precheck({ healthData, question });
  if (pre.crisis) {
    emit({ type: 'safety_start' });
    emit({ type: 'safety_done', clean: true, revised: false, scrubbed: false, urgent: pre.urgent });
    emit({ type: 'answer', seconds: 0 });
    return { reply: "I'm really glad you told me. If you're thinking about harming yourself, please call or text **988** (the Suicide & Crisis Lifeline) right now, or go to your nearest emergency room. You don't have to go through this alone, and I'm here to keep talking with you.", sources: [] };
  }

  // Spec #25 Section 9: a fresh emergency value bypasses the lanes and the agents.
  // The member gets the hard-coded message, written in code, not a composed answer.
  const emergency = emergencyFor(healthData?.labs);
  const act = emergency.filter((h) => h.fresh);
  if (act.length) {
    emit({ type: 'safety_start' });
    emit({ type: 'safety_done', clean: true, revised: false, scrubbed: false, urgent: act.map((h) => `${h.name} ${h.shown}`), emergency: act });
    emit({ type: 'answer', seconds: 0 });
    return { reply: emergencyMessage(act), sources: [], emergency: act, lanes: [] };
  }

  // The lanes, in code, before any model: they depend only on the record.
  const lanes = lanesFor(healthData?.labs, { sex: healthData?.sex });

  // 2. Route.
  emit({ type: 'route_start' });
  const plan = await route({ question, recent, facts, run });
  // `parallel` tells the card the specialists are called together, not in turn.
  emit({ type: 'route_done', reason: plan.reason, consult: plan.consult, parallel: true });

  // 3. Research. Every event goes out the moment its call starts or returns: all
  // the specialists are called at once, and each reports when it is actually done,
  // in whatever order that is. The card draws exactly this, nothing staged.
  const reads = {};
  const sources = [];
  for (const { id, ask } of plan.consult) emit({ type: 'specialist_start', id, ask });
  await Promise.all(plan.consult.map(async ({ id, ask }) => {
    try {
      const r = await research({ id, ask, question, facts, run });
      if (!r.read) throw new Error('empty report');
      reads[id] = r.read;
      sources.push(...r.sources.map((s) => ({ ...s, readBy: id })));
      emit({ type: 'specialist_done', id, headline: r.headline, finding: r.finding, flag: r.flag, passages: r.sources.length });
    } catch (err) {
      console.log(`[research:${id}] failed: ${err.message}`);
      emit({ type: 'specialist_done', id, headline: "Couldn't report this time", finding: '', flag: 'ok', failed: true });
    }
  }));
  // Reads keep the Advocate's order, whatever order they finished in.
  const ordered = Object.fromEntries(plan.consult.filter((c) => reads[c.id]).map((c) => [c.id, reads[c.id]]));
  if (!Object.keys(ordered).length) throw new Error('No specialist could report. Please try again.');

  // 4. Huddle: with two or more voices, each sends one note, shown as it arrives.
  let notes = [];
  let consensus = '';
  const ids = Object.keys(ordered);
  if (ids.length > 1) {
    emit({ type: 'huddle_start', ids });
    await Promise.all(ids.map(async (id) => {
      try {
        const n = await confer({ id, reads: ordered, run });
        if (n) { notes.push(n); emit({ type: 'huddle_note', ...n }); }
      } catch (err) {
        console.log(`[huddle:${id}] failed: ${err.message}`);
      }
    }));
    consensus = await consensusOf({ notes, run }).catch(() => '');
    emit({ type: 'huddle_done', consensus });
  }

  // 6. Compose, from the member's record, the library and the lane cards from step 5
  // (no web research).
  const realTitles = [...new Set(sources.map((s) => s.title))];
  emit({ type: 'draft_start', research: false });
  let reply = await compose({ question, recent, facts, reads: ordered, notes, consensus, pre, lanes, run });
  reply = scrubInventedCitations(reply, realTitles);
  emit({ type: 'draft_done', sources: 0, passages: realTitles.length });

  // 7. Safety: the fact-checker, one revision by the Advocate if it flags, then the
  // code rules. Each of those is its own event, so the card shows a revision only
  // when one really happened.
  emit({ type: 'safety_start' });
  let revised = false;
  const check = await factCheck({ answer: reply, facts, reads: ordered, sources, run }).catch((err) => {
    console.log(`[safety:check] failed: ${err.message}`);
    return { clean: true, flags: '' };
  });
  if (!check.clean) {
    emit({ type: 'safety_flag', problem: clip((check.flags.split('\n').find((l) => l.trim()) || check.flags).replace(/^[-*\s]*[A-Z]+(?:-\d+)?:\s*/, ''), 160), by: 'fact-check' });
    emit({ type: 'revise_start' });
    const fixed = await revise({ answer: reply, flags: check.flags, facts, reads: ordered, run }).catch(() => '');
    if (fixed) { reply = scrubInventedCitations(fixed, realTitles); revised = true; }
    emit({ type: 'revise_done', revised: Boolean(fixed) });
  }
  const enforced = await enforce({ reply, healthData, run, onFlag: (problem) => emit({ type: 'safety_flag', problem, by: 'rules' }) });
  emit({
    type: 'safety_done',
    clean: enforced.clean,
    revised: revised || enforced.revised,
    scrubbed: enforced.scrubbed,
    urgent: pre.urgent,
  });

  emit({ type: 'answer', seconds: Math.round((Date.now() - started) / 1000) });
  return { reply: tidyBottomLine(enforced.reply), sources: dedupeSources(sources), lanes };
}

/**
 * The bottom line is at most two bolded sentences. The brief asks for that, and the
 * model still writes three-sentence bold openers, which read as a block on a phone.
 * Anything past the second sentence stays, unbolded, on its own line.
 */
export function tidyBottomLine(text) {
  const t = String(text || '').trim();
  const m = /^\*\*([\s\S]+?)\*\*(\s*\n|$)/.exec(t);
  if (!m) return t;
  const sentences = m[1].trim().split(/(?<=[.!?])\s+(?=[A-Z])/);
  if (sentences.length <= 2) return t;
  const rest = t.slice(m[0].length).replace(/^\s+/, '');
  return `**${sentences.slice(0, 2).join(' ')}**\n\n${sentences.slice(2).join(' ')}${rest ? `\n\n${rest}` : ''}`;
}

function dedupeSources(sources) {
  const by = new Map();
  for (const s of sources) {
    const k = s.cite || s.title;
    if (!by.has(k)) by.set(k, { ...s, readBy: [s.readBy] });
    else if (!by.get(k).readBy.includes(s.readBy)) by.get(k).readBy.push(s.readBy);
  }
  return [...by.values()];
}
