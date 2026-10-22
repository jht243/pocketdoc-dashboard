/**
 * Checking what a model read off a health document against the document.
 *
 * Oct 21 2026: a scanned lab report was "transcribed" with its header copied exactly
 * and most of its values invented (glucose 112 read as 91, a vitamin D result that
 * was not on the report added, three rows dropped). Everything downstream trusted
 * that text: the stored transcription, the markers pulled from it, and every agent
 * answer built on both. A model's read of a number is a claim, not a fact, so:
 *
 *  - A PDF with a real text layer is checked against that text, number by number.
 *  - A scan or a photo is read twice, independently, and the two reads are compared
 *    row by row. Rows that disagree, or that only one read saw, get a third, targeted
 *    read; a value two reads agree on is kept, anything else is marked unclear and is
 *    never recorded as a result.
 *  - Markers pulled from the text must trace to a line of it: the value, the unit and
 *    the range as printed on that marker's row.
 *
 * Pure: no browser, no network, so the agents' node tests can run it.
 */

/** What an unreadable row becomes in the stored transcription, in place of a guess. */
export const UNCLEAR_MARK = "[unclear on the document — not recorded]";

const STOP = new Set([
  "the", "and", "for", "with", "of", "to", "in", "on", "at", "by", "or", "a", "an",
  "high", "low", "normal", "flag", "abnormal", "result", "results", "range", "ref", "reference",
]);

const NUMBER = /(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?/g;

/** The numbers on a line, normalised ("1,200" → "1200", "4.20" → "4.2"), in order. */
export function numbersOf(line) {
  return (String(line || "").match(NUMBER) || []).map((n) => String(Number(n.replace(/,/g, ""))));
}

// Genetic values are not numbers: rsIDs, allele calls (CT, C/T), star alleles (*1/*2).
const GENETIC = /\brs\d{3,}\b|\*\d+[A-Z]?(?:\/\*\d+[A-Z]?)?|(?<![A-Za-z])[ACGT](?:\/|;)?[ACGT](?![A-Za-z])|\b[ACGT]\d{2,5}[ACGT]\b/g;

/**
 * Every value a line states: its numbers, plus the genetic values a DNA report prints
 * (rsIDs, genotypes, star alleles), normalised so "C/T", "C;T" and "CT" are one call.
 */
export function valuesOf(line) {
  const genetic = (String(line || "").match(GENETIC) || []).map((g) => (/^[ACGT][/;]?[ACGT]$/.test(g) ? g.replace(/[/;]/, "") : g.toLowerCase()));
  return [...numbersOf(String(line || "").replace(GENETIC, " ")), ...genetic];
}

/** The words that name a line's row: lowercase, letters only, minus filler. */
export function labelOf(line) {
  return [...new Set((String(line || "").toLowerCase().match(/[a-z]{2,}/g) || []).filter((w) => !STOP.has(w)))];
}

// Dates and clock times are not results: a header line carrying a collection and a
// report date is checked by `checkDates`, not compared row by row as a result.
const DATE = /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g;
const TIME = /\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?\b/gi;
const withoutDates = (line) => String(line || "").replace(DATE, " ").replace(TIME, " ");

/** A printed date as ISO: "10/14/2026" (US order unless the first part can't be a month), "2026-10-14". */
function dateKey(printed) {
  const parts = printed.split(/[/.-]/).map(Number);
  let [y, mo, d] = parts[0] > 999 ? parts : [parts[2], parts[0], parts[1]];
  if (parts[0] <= 999 && parts[0] > 12) [mo, d] = [parts[1], parts[0]];
  if (y < 100) y += 2000;
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** The dates printed in a text, normalised so "10/14/2026", "10/14/26" and "2026-10-14" are one date. */
export function datesOf(text) {
  return [...new Set((String(text || "").match(DATE) || []).map(dateKey).filter(Boolean))];
}

/** Lines that carry a result: a number that isn't a date or time, and a naming word. */
export function resultLines(text) {
  return String(text || "").split("\n").map((l) => l.trim()).filter((l) => l && valuesOf(withoutDates(l)).length && labelOf(l).length && !l.includes(UNCLEAR_MARK));
}

/** What a date only one read saw becomes, in place of a guess. */
export const DATE_UNCLEAR = "[date unclear]";

/**
 * Every date the first read gives must be in the second read too. A collection date
 * is what places a panel on the member's timeline, so a date only one read saw is
 * replaced with DATE_UNCLEAR rather than trusted.
 *
 * @returns {{ text: string, unclear: string[] }}
 */
export function checkDates(primary, second) {
  const seen = new Set(datesOf(second));
  const unclear = [];
  const text = String(primary || "").replace(DATE, (d) => {
    if (seen.has(dateKey(d))) return d;
    unclear.push(d);
    return DATE_UNCLEAR;
  });
  return { text, unclear };
}

/** Overlap of two lines' naming words (Jaccard), 0–1. */
export function similarity(a, b) {
  const x = new Set(labelOf(a));
  const y = new Set(labelOf(b));
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both += 1;
  return both / (x.size + y.size - both);
}

const rsidOf = (line) => (/\brs\d{3,}\b/i.exec(String(line || "")) || [])[0]?.toLowerCase() || null;

/**
 * How surely two reads' lines are the same row. The same rsID is the same row. Else
 * the naming words: one read often adds words the other leaves out ("Glucose,
 * Fasting" against "Glucose"), so the overlap counts against the shorter name, and
 * the first naming word (the marker or gene) must agree.
 */
function rowMatch(a, b) {
  const ra = rsidOf(a);
  if (ra && ra === rsidOf(b)) return 1;
  const x = labelOf(a);
  const y = labelOf(b);
  if (!x.length || !y.length || x[0] !== y[0]) return similarity(a, b);
  const ys = new Set(y);
  const both = x.filter((w) => ys.has(w)).length;
  return Math.max(similarity(a, b), both / Math.min(x.length, y.length));
}

const sameNumbers = (a, b) => {
  const x = valuesOf(a).sort();
  const y = valuesOf(b).sort();
  return x.length === y.length && x.every((n, i) => n === y[i]);
};

const MATCH = 0.5;

/** The best unused line of `pool` for `line`, by naming words, or null. */
function bestMatch(line, pool, used) {
  let best = null;
  let score = MATCH - 1e-9;
  pool.forEach((cand, i) => {
    if (used.has(i)) return;
    const s = rowMatch(line, cand);
    if (s > score) { score = s; best = i; }
  });
  return best;
}

/**
 * Two independent reads of the same document, row by row.
 *
 * @returns {{ agreed: string[], disputed: {primary: string, second: string|null}[], missing: string[] }}
 *   agreed    rows both reads gave with the same numbers
 *   disputed  rows of the first read the second read gave differently, or not at all
 *   missing   rows only the second read saw
 */
export function reconcile(primary, second) {
  const a = resultLines(primary);
  const b = resultLines(second);
  const used = new Set();
  const agreed = [];
  const disputed = [];
  for (const line of a) {
    const i = bestMatch(line, b, used);
    if (i == null) { disputed.push({ primary: line, second: null }); continue; }
    used.add(i);
    if (sameNumbers(line, b[i])) agreed.push(line);
    else disputed.push({ primary: line, second: b[i] });
  }
  const missing = b.filter((_, i) => !used.has(i));
  return { agreed, disputed, missing };
}

/** The naming part of a row, for the unclear line: everything before its first number. */
function rowName(line) {
  const rs = /\brs\d{3,}\b/i.exec(String(line));
  if (rs) return String(line).slice(0, rs.index + rs[0].length).replace(/\s+/g, " ").trim();
  const at = String(line).search(/\d/);
  const head = (at > 0 ? line.slice(0, at) : line).replace(/[:\-–—|]+\s*$/, "").trim();
  return head || labelOf(line).join(" ");
}

/**
 * Settle the disputes with a third, targeted read (`tieText`: one line per row it was
 * asked about). A row two reads agree on is kept as they read it; anything else becomes
 * an UNCLEAR_MARK line in the transcription. Rows only the second read saw are added,
 * in their own block, only when the third read confirms them.
 *
 * @returns {{ text: string, unclear: string[], recovered: string[] }}
 */
export function applyTieBreak(primary, { disputed = [], missing = [] }, tieText = "") {
  const tie = resultLines(tieText);
  const used = new Set();
  const settle = (row) => {
    const i = bestMatch(row, tie, used);
    if (i == null) return null;
    used.add(i);
    return tie[i];
  };
  let text = String(primary || "");
  const unclear = [];
  for (const { primary: row, second } of disputed) {
    const third = settle(row);
    let keep = null;
    if (third && sameNumbers(third, row)) keep = row;
    else if (third && second && sameNumbers(third, second)) keep = second;
    if (keep === row) continue;
    const replacement = keep || `${rowName(row)}: ${UNCLEAR_MARK}`;
    if (!keep) unclear.push(rowName(row));
    text = text.split("\n").map((l) => (l.trim() === row ? replacement : l)).join("\n");
  }
  const recovered = [];
  for (const row of missing) {
    const third = settle(row);
    if (third && sameNumbers(third, row)) recovered.push(row);
  }
  if (recovered.length) text = `${text.trimEnd()}\n\nRows confirmed on a second read:\n${recovered.join("\n")}`;
  return { text, unclear, recovered };
}

/** Rows the transcription marks as unclear, by name. */
export function unclearNames(text) {
  return String(text || "").split("\n").filter((l) => l.includes(UNCLEAR_MARK)).map((l) => l.replace(UNCLEAR_MARK, "").replace(/[:\s]+$/, "").trim()).filter(Boolean);
}

/**
 * Numbers on the transcription's result lines that the source text does not contain:
 * what a model added or changed when it reformatted a PDF's own text layer.
 */
export function untracedAgainst(text, source) {
  const known = new Set(numbersOf(source));
  const out = [];
  for (const line of resultLines(text)) for (const n of numbersOf(line)) if (!known.has(n)) out.push(n);
  return [...new Set(out)];
}

const unitKey = (u) => String(u || "").toLowerCase().replace(/[µμ]/g, "u").replace(/\s+/g, "");

/**
 * Keep only markers the text itself supports: a line naming the marker carries its
 * value, its unit (when it has one) and its range numbers (a range not on that line
 * is cleared rather than trusted). Everything else is dropped and named.
 *
 * @param {Array} markers  [{ name, value, unit, range, status }]
 * @param {string} text    the checked transcription
 * @returns {{ kept: Array, dropped: string[] }}
 */
export function traceMarkers(markers = [], text = "") {
  const lines = resultLines(text);
  const kept = [];
  const dropped = [];
  for (const m of markers) {
    const value = numbersOf(m?.value)[0];
    const name = String(m?.name || "").trim();
    const nameLower = name.toLowerCase();
    const row = value == null ? null : lines.find((l) => {
      const named = l.toLowerCase().includes(nameLower) || similarity(name, l) >= 0.34;
      return named && numbersOf(l).includes(value);
    });
    const unit = unitKey(m?.unit);
    if (!row || (unit && !unitKey(row).includes(unit))) { dropped.push(name || "a result"); continue; }
    const rangeNums = numbersOf(m?.range);
    const rangeOk = rangeNums.every((n) => numbersOf(row).includes(n));
    kept.push(rangeOk ? m : { ...m, range: null, status: "unknown" });
  }
  return { kept, dropped };
}

/**
 * A PDF page's text items (pdf.js getTextContent) as lines, top to bottom, left to
 * right, so a table row reads as one line the way it is printed.
 */
export function linesFromItems(items = []) {
  const rows = [];
  for (const it of items) {
    const s = String(it?.str ?? "");
    if (!s.trim()) continue;
    const x = it.transform?.[4] ?? 0;
    const y = it.transform?.[5] ?? 0;
    const h = Math.max(2, Math.abs(it.height || it.transform?.[3] || 10));
    let row = rows.find((r) => Math.abs(r.y - y) <= h * 0.5);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, s });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).join("  "))
    .join("\n");
}

/** Whether a PDF's own text is enough to read its results from (a text layer, not a scan). */
export const hasUsableText = (text) => resultLines(text).length >= 3;

/* ---------------- what the specialists file ---------------- */

/** The first line of a transcription the reads checked; anything without it predates them. */
export const CHECKED_MARK = "[Checked: every result below was read twice from the document and agreed, or is marked unclear.]";

/** Whether a stored transcription went through the checked reads. */
export const isChecked = (text) => String(text || "").trimStart().startsWith(CHECKED_MARK);

const norm = (t) => String(t || "").toLowerCase().replace(/[^a-z0-9*]+/g, " ").trim();

/**
 * Whether a passage the model says it quoted from the document is actually there:
 * most of its four-word runs appear in the transcription. Quotes get light rewording
 * (line breaks, a dropped "the"); invented sentences share almost nothing.
 */
export function supportedText(passage, text, share = 0.7) {
  const words = norm(passage).split(" ").filter(Boolean);
  if (!words.length) return false;
  const hay = ` ${norm(text)} `;
  if (words.length < 4) return hay.includes(` ${words.join(" ")} `);
  let hit = 0;
  const runs = words.length - 3;
  for (let i = 0; i < runs; i++) if (hay.includes(` ${words.slice(i, i + 4).join(" ")} `)) hit += 1;
  return hit / runs >= share;
}

/**
 * A collection date the extraction gave ("YYYY-MM-DD") only stands if that date is
 * printed in the checked text (in any of the usual orders); otherwise it is null.
 */
export function verifiedDate(iso, text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || "").trim());
  if (!m) return null;
  const key = `${m[1]}-${m[2]}-${m[3]}`;
  // A printed d/m order counts too ("14/10/2026"), as dateKey reads day-first only when it must.
  const swapped = `${m[1]}-${m[3]}-${m[2]}`;
  const printed = new Set(datesOf(text));
  return printed.has(key) || printed.has(swapped) ? key : null;
}


/**
 * The collection date as printed, read in code: the date on a line naming the
 * collection or draw, else the report date, else null. It never comes from a model.
 */
export function collectionDate(text) {
  const lines = String(text || "").split("\n");
  const on = (re) => {
    for (const l of lines) {
      if (!re.test(l)) continue;
      const after = l.slice(l.search(re));
      const hit = (after.match(DATE) || [])[0];
      if (hit) return dateKey(hit);
    }
    return null;
  };
  return on(/collect|drawn|draw date|specimen|sample date/i) || on(/report|result(?:ed)?\s+date|received/i);
}

/**
 * Keep only what a DNA report actually says. A gene must be printed; an rsID and a
 * genotype, when given, must be printed on a line naming that gene or rsID. The
 * report's own notes, recommendations and medication notes stay only if they are in
 * the text. The extractor's own summary and AI context are never filed: they are its
 * words, not the report's, and the Genetics specialist explains a result when asked.
 *
 * @returns {{ kept: Array, dropped: string[] }}
 */
export function traceGenetic(items = [], text = "") {
  const lines = String(text || "").split("\n");
  const hay = String(text || "");
  const kept = [];
  const dropped = [];
  for (const g of items) {
    const gene = String(g?.gene || "").trim();
    const geneRe = gene ? new RegExp(`\\b${gene.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") : null;
    if (!geneRe || !geneRe.test(hay)) { dropped.push(gene || "a variant"); continue; }
    const rsid = String(g?.rsid || "").trim().toLowerCase();
    if (rsid && !hay.toLowerCase().includes(rsid)) { dropped.push(gene); continue; }
    const call = valuesOf(String(g?.genotype || ""))[0];
    if (call) {
      const near = lines.some((l, i) => {
        const block = lines.slice(Math.max(0, i - 1), i + 2).join(" ");
        return (geneRe.test(l) || (rsid && l.toLowerCase().includes(rsid))) && valuesOf(block).includes(call);
      });
      if (!near) { dropped.push(gene); continue; }
    }
    kept.push({
      ...g,
      variant: g?.variant && supportedText(g.variant, hay, 0.5) ? g.variant : null,
      notes: g?.notes && supportedText(g.notes, hay) ? g.notes : null,
      recommendations: (g?.recommendations || []).filter((r) => supportedText(r, hay)),
      medications: (g?.medications || [])
        .filter((m) => m?.name && norm(hay).includes(norm(m.name)))
        .map((m) => ({ ...m, note: m.note && supportedText(m.note, hay) ? m.note : null })),
      summary: null,
      aiContext: null,
      what: null,
    });
  }
  return { kept, dropped };
}
