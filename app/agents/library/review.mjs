// The library review list. Adam Locker, Oct 19 2026: the approved reference library
// is the only source for health answers, so it is reviewed on a set cadence.
//
// Cadence: every passage is reviewed once a quarter (90 days). A review means the
// medical director re-reads the passage against its source and either confirms it,
// edits it, or retires it. Record it in the passage's frontmatter:
//
//   approved_by: <name>, <YYYY-MM-DD>
//   reviewed: <YYYY-MM-DD>
//
// Run: npm run library:review. It writes library/REVIEW.md, the checklist for the
// next review session: passages never approved, passages whose last review is more
// than 90 days old, and sources older than five years (worth checking for a newer
// guideline).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listPassages } from './readme.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const REVIEW_EVERY_DAYS = 90;
export const OLD_SOURCE_YEARS = 5;

const DAY = 24 * 60 * 60 * 1000;

/** Which passages are due, as of `today`. */
export function reviewList(passages, today = new Date()) {
  const never = [];
  const overdue = [];
  const oldSource = [];
  for (const p of passages) {
    if (!p.approved_by || p.approved_by === 'pending') never.push(p);
    else {
      const last = Date.parse(p.reviewed || '');
      if (!Number.isFinite(last) || (today - last) / DAY > REVIEW_EVERY_DAYS) overdue.push(p);
    }
    const year = Number(String(p.as_of || '').slice(0, 4));
    if (year && today.getFullYear() - year > OLD_SOURCE_YEARS) oldSource.push(p);
  }
  return { never, overdue, oldSource };
}

function render({ never, overdue, oldSource }, total, today) {
  const day = today.toISOString().slice(0, 10);
  const row = (p) => `| [${p.title}](reference/${p.path}) | ${p.section} | ${p.as_of || '?'} | ${p.reviewed || 'never'} |`;
  const table = (list) => list.length
    ? ['| Passage | Section | Source date | Last reviewed |', '|---|---|---|---|', ...list.map(row)]
    : ['None.'];
  return [
    '# Library review',
    '',
    `Generated ${day} by \`npm run library:review\`. The library is reviewed every quarter (${REVIEW_EVERY_DAYS} days); see the header of \`review.mjs\` for how to record a review.`,
    '',
    `${total} passages: ${never.length} never approved, ${overdue.length} approved but overdue for review, ${oldSource.length} with a source more than ${OLD_SOURCE_YEARS} years old.`,
    '',
    `## Never approved (${never.length})`,
    '',
    ...table(never),
    '',
    `## Overdue for quarterly review (${overdue.length})`,
    '',
    ...table(overdue),
    '',
    `## Source more than ${OLD_SOURCE_YEARS} years old (${oldSource.length})`,
    '',
    'Check whether a newer guideline has replaced it.',
    '',
    ...table(oldSource),
    '',
  ].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const passages = listPassages();
  const today = new Date();
  const due = reviewList(passages, today);
  writeFileSync(join(here, 'REVIEW.md'), render(due, passages.length, today));
  console.log(`library/REVIEW.md: ${due.never.length} never approved, ${due.overdue.length} overdue, ${due.oldSource.length} old sources`);
}
