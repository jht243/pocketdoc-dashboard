// Reading an uploaded document into the member's record: the specialist reads, the
// Fact Checker reads independently, and code files only what both reads support.
//
// Oct 21 2026: a scanned report was read in the browser by one prompt, which copied
// the header and invented most of the values. Reading is now the team's job:
//
//   1. tools      docTools.mjs: the PDF's own text layer, or its pages rendered sharp,
//                 or the photo, at high detail
//   2. specialist Blood Work (lab reports) or Genetics (DNA reports) transcribes
//   3. checker    a PDF's text layer is checked in code (a number the specialist
//                 changed means the raw text is kept). A scan or photo: the Fact
//                 Checker reads it independently, code compares row by row, the Fact
//                 Checker re-reads anything disputed; a value two reads don't agree on
//                 is marked unclear and never filed. Dates the same way.
//   4. specialist extracts the record (markers, or genes) from the checked text
//   5. code       every marker traces to its own row (value, unit, range); every gene,
//                 rsID and genotype to the text; the collection date to a printed date
//
// Whatever was marked unclear or dropped is logged to ghai.safety_events for the
// medical director, like a blocked chat answer.
import { complete, parseJson } from './llm.mjs';
import { brief } from './config.mjs';
import { readEvidence, imageParts, MAX_PAGES } from './docTools.mjs';
import { noteSafety, clip } from './team.mjs';
import {
  CHECKED_MARK, UNCLEAR_MARK, applyTieBreak, checkDates, collectionDate, reconcile, traceGenetic, traceMarkers,
  unclearNames, untracedAgainst, verifiedDate,
} from '../../src/lib/readCheck.js';

const READER = { labs: 'bloodwork-import', genetic: 'genetics-import' };
const CHECKER = 'fact-checker';

const says = (text) => [{ type: 'text', text }];

// A row the specialist itself couldn't read stays in the record as unclear, by name.
const markUnreadable = (text) => String(text || '').replace(/[:\s]+UNREADABLE\b.*$/gim, `: ${UNCLEAR_MARK}`);

async function ask(agent, parts, prompt, { maxTokens = 8192, label, run }) {
  return complete({
    system: brief(agent),
    messages: [{ role: 'user', content: [...parts, { type: 'text', text: prompt }] }],
    tier: 'smart', maxTokens, temperature: 0, label, run,
  });
}

/** Turn the extractor's reply into an array of objects, tolerating fences, prose or a cut-off tail. */
function objectsIn(raw) {
  const whole = parseJson(raw);
  if (Array.isArray(whole)) return whole;
  try {
    const start = raw.indexOf('[');
    const arr = start >= 0 ? JSON.parse(raw.slice(start, raw.lastIndexOf(']') + 1)) : null;
    if (Array.isArray(arr)) return arr;
  } catch { /* fall through */ }
  return [...String(raw).matchAll(/\{[^{}]*\}/g)].map((m) => { try { return JSON.parse(m[0]); } catch { return null; } }).filter(Boolean);
}

/**
 * Transcribe and check (steps 1–3).
 * @returns {Promise<{ text: string, unclear: string[], evidence: string, pages: number, pageCount: number }>}
 */
async function readChecked({ kind, file, mediaType, run, emit }) {
  const reader = READER[kind] || READER.labs;
  emit({ type: 'tools_start' });
  const ev = await readEvidence({ file, mediaType });
  emit({ type: 'tools_done', evidence: ev.kind, pages: ev.read });

  if (ev.kind === 'text') return { text: ev.text.trim(), unclear: [], evidence: ev.kind, pages: 1, pageCount: 1 };

  emit({ type: 'read_start', by: reader });
  if (ev.kind === 'pdf-text') {
    const shaped = await ask(reader, says(`The document's own text (its PDF text layer; rows in printed order, columns separated by spaces):\n\n${ev.text}`),
      'Task 1: transcribe this document, keeping every value exactly as it appears above.', { label: 'ingest:transcribe', run });
    emit({ type: 'read_done', by: reader });
    // Code is the checker here: the text layer is the document.
    const changed = untracedAgainst(shaped, ev.text);
    if (changed.length) noteSafety(run, { kind: 'fact_check', rule: `[ingest] The specialist's transcription changed or added numbers not in the PDF's own text (${changed.join(', ')}); the raw text was kept.`, excerpt: changed.join(', ') });
    const text = !shaped || shaped === 'NO_CONTENT' ? shaped : changed.length ? ev.text : shaped;
    return { text, unclear: [], evidence: ev.kind, pages: ev.read, pageCount: ev.pageCount };
  }

  const parts = imageParts(ev.pages);
  const first = markUnreadable(await ask(reader, parts, 'Task 1: transcribe this document.', { label: 'ingest:transcribe', run }));
  emit({ type: 'read_done', by: reader });
  if (!first || first === 'NO_CONTENT') return { text: first, unclear: [], evidence: ev.kind, pages: ev.read, pageCount: ev.pageCount };

  emit({ type: 'check_start', by: CHECKER });
  const second = await ask(CHECKER, parts, 'Read 1: copy every line that carries a value, exactly as printed.', { maxTokens: 4096, label: 'ingest:check', run });
  const found = reconcile(first, second);
  let settled = { text: first, unclear: [], recovered: [] };
  if (found.disputed.length || found.missing.length) {
    const rows = [...found.disputed.map((d) => d.primary), ...found.missing];
    emit({ type: 'check_dispute', rows: rows.length });
    const third = await ask(CHECKER, parts, `Read 2: settle these rows.\n${rows.join('\n')}`, { maxTokens: 2048, label: 'ingest:settle', run }).catch(() => '');
    settled = applyTieBreak(first, found, third);
  }
  // Dates only one read saw get a targeted read too, before anything is marked unclear.
  let dateSource = second;
  if (checkDates(settled.text, second).unclear.length) {
    const dates = await ask(CHECKER, parts, 'Read 2: write every date printed on the document, one per line, with its label exactly as printed (e.g. "Collected: 10/14/2026").', { maxTokens: 400, label: 'ingest:dates', run }).catch(() => '');
    dateSource = `${second}\n${dates}`;
  }
  const dated = checkDates(settled.text, dateSource);
  const unclear = [...settled.unclear, ...dated.unclear.map((d) => `date ${d}`)];
  emit({ type: 'check_done', by: CHECKER, agreed: found.agreed.length, settled: found.disputed.length - settled.unclear.length, unclear: unclear.length, recovered: settled.recovered.length });
  if (unclear.length) noteSafety(run, { kind: 'fact_check', rule: `[ingest] Two reads of the document did not agree on: ${unclear.join('; ')}. Marked unclear, not filed.`, excerpt: clip(unclear.join('; '), 400) });
  return { text: dated.text, unclear, evidence: ev.kind, pages: ev.read, pageCount: ev.pageCount };
}

/**
 * @param {object} o
 * @param {'labs'|'genetic'} o.kind
 * @param {string} o.file        base64
 * @param {string} [o.mediaType]
 * @param {boolean} [o.extract]  false: transcribe and check only
 * @param {object} o.run         { auth, ledger, safety }
 * @param {Function} [send]      progress events
 * @returns {Promise<object>} { text, unclear, dropped, markers | genetics, drawnOn, source, empty, readBy, checkedBy, evidence }
 */
export async function runIngest({ kind = 'labs', file, mediaType = '', extract = true, run }, send = () => {}) {
  const started = Date.now();
  const emit = (e) => send({ ...e, t: Date.now() - started });
  const reader = READER[kind] || READER.labs;
  const read = await readChecked({ kind, file, mediaType, run, emit });
  const base = { readBy: reader.replace('-import', ''), checkedBy: CHECKER, evidence: read.evidence };
  const body = String(read.text || '').trim();
  if (!body || body === 'NO_CONTENT') return { ...base, text: '', unclear: [], dropped: [], markers: [], genetics: [], drawnOn: null, source: null, empty: true };

  const truncated = read.pageCount > read.pages ? `\n\n[Only the first ${MAX_PAGES} of ${read.pageCount} pages were read.]` : '';
  const text = `${CHECKED_MARK}\n${body}${truncated}`;
  if (!extract) return { ...base, text, unclear: read.unclear, dropped: [] };

  emit({ type: 'extract_start', by: reader });
  if (kind === 'genetic') {
    const raw = await ask(reader, says(`Checked transcription:\n\n${body}`), 'Task 2: extract every gene or variant this report discusses, as a JSON array.', { label: 'ingest:extract', run });
    const { kept, dropped } = traceGenetic(objectsIn(raw).filter((g) => g?.gene), body);
    if (dropped.length) noteSafety(run, { kind: 'fact_check', rule: `[ingest] Genetic results not supported by the report were not filed: ${dropped.join(', ')}.`, excerpt: clip(dropped.join(', '), 400) });
    emit({ type: 'extract_done', by: reader, filed: kept.length, dropped: dropped.length });
    return { ...base, text, unclear: read.unclear, dropped, genetics: kept, empty: !kept.length && /^\s*\[\s*\]\s*$/.test(String(raw).replace(/```json|```/g, '')) };
  }

  const raw = await ask(reader, says(`Checked transcription:\n\n${body}`), 'Task 2: extract this panel\'s collection date, lab, and every marker, as JSON.', { maxTokens: 4096, label: 'ingest:extract', run });
  const envelope = parseJson(raw) || {};
  const markers = Array.isArray(envelope.markers) ? envelope.markers : objectsIn(raw).filter((m) => m?.name && m?.value != null);
  const { kept: traced, dropped } = traceMarkers(markers.filter((m) => m?.name), body);
  // A range is filed as printed inside the brackets the transcription puts round it.
  const kept = traced.map((m) => (m.range ? { ...m, range: String(m.range).trim().replace(/^\((.*)\)$/, '$1').trim() } : m));
  if (dropped.length) noteSafety(run, { kind: 'fact_check', rule: `[ingest] Markers that did not match their own row of the checked report were not filed: ${dropped.join(', ')}.`, excerpt: clip(dropped.join(', '), 400) });
  // The collection date is read in code from the checked text; the extractor's date
  // only stands where code finds none and that date is printed.
  const drawnOn = collectionDate(body) || verifiedDate(envelope.drawn_on, body);
  const source = envelope.source && String(body).toLowerCase().includes(String(envelope.source).toLowerCase()) ? String(envelope.source).trim() : null;
  emit({ type: 'extract_done', by: reader, filed: kept.length, dropped: dropped.length });
  return {
    ...base, text,
    unclear: [...new Set([...read.unclear, ...unclearNames(body)])],
    dropped, markers: kept, drawnOn, source,
    empty: !markers.length,
  };
}
