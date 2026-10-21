/**
 * Every number a model writes about a member must come from the data it was given.
 *
 * The insight cards are told "every number must trace to the data above", and a
 * prompt is a request, not a guarantee. This is the guarantee: a card is checked
 * number by number against the exact text the model was handed, and a card holding
 * a number that text does not contain is dropped (the screens fall back to their
 * deterministic cards).
 *
 * Small whole numbers (31 and under) with no unit are exempt: they are counts, days
 * of the month and spans ("3 panels", "Oct 13", "7-day trend") that a correct card
 * writes in its own words. Decimals, larger values and any number carrying a unit
 * ("28 ng/mL", "12%", "9 ms") are always checked.
 *
 * Plain JavaScript with no browser imports, so the agents' tests can run it.
 */
const NUMBER = /(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?/g;

// What follows a measured value: a lab, wearable or body unit.
const UNIT = /^\s?(?:%|ng|mg|mcg|µg|ug|iu|mmol|nmol|pmol|µmol|umol|uiu|µiu|miu|meq|ms\b|bpm|kg|lbs?\b|mm\b|fl\b|pg|g\/|u\/l|units?\b|ml\b|dl\b|x\s?10|k\/u|cells|points?\b)/i;

/** "1,000" → "1000", "4.50" → "4.5", "07" → "7". */
const normalize = (n) => String(Number(n.replace(/,/g, "")));

function numbersIn(text) {
  const t = String(text || "");
  return [...t.matchAll(NUMBER)].map((m) => ({
    n: normalize(m[0]),
    unit: UNIT.test(t.slice(m.index + m[0].length, m.index + m[0].length + 8)),
  }));
}

/** The numbers in `text` that `source` never mentions, exemptions aside. */
export function untracedNumbers(text, source) {
  const known = new Set(numbersIn(source).map((x) => x.n));
  const out = new Set();
  for (const { n, unit } of numbersIn(text)) {
    const v = Number(n);
    if (!unit && Number.isInteger(v) && v <= 31) continue;
    if (!known.has(n)) out.add(n);
  }
  return [...out];
}
