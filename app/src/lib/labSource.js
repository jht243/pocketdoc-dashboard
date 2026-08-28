/**
 * Lab source names arrive from the report exactly as the lab prints them —
 * "Quest Diagnostics Nichols Institute, Chantilly, VA" — which wraps to three
 * lines in a provenance row where the member only needs to know it was Quest.
 * The branch, the corporate suffix, and the address are noise; the brand is
 * the fact. Everything unrecognized falls back to its first segment, trimmed
 * of the boilerplate and capped so no single row can run away.
 */

const MAX = 22;

// Matched as substrings against the raw source, longest-first, so a report that
// says "Quest Diagnostics Nichols Institute" and one that says "Quest" collapse
// to the same label the member already recognizes from the lab's own branding.
const BRANDS = [
  "Quest",
  "Labcorp",
  "BioReference",
  "Sonic Healthcare",
  "ARUP",
  "Mayo Clinic",
  "Cleveland HeartLab",
  "Boston Heart",
  "Function Health",
  "InsideTracker",
  "Everlywell",
  "Tasso",
];

// Corporate boilerplate that never distinguishes one draw from another.
const SUFFIXES = /\b(diagnostics?|laborator(?:y|ies)|labs?|nichols institute|institute|medical center|clinic|health(?:care)? system|services|company|corporation|corp|incorporated|inc|llc|ltd|pa|pc)\b\.?/gi;

export function shortLabSource(raw) {
  const src = String(raw || "").trim();
  if (!src) return "";
  for (const brand of BRANDS) {
    if (src.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  // Not a lab we know: keep the part before the first comma — the name, without
  // the branch and address that follow it — then drop the suffix words.
  let name = src.split(",")[0].trim();
  const stripped = name.replace(SUFFIXES, " ").replace(/\s{2,}/g, " ").trim();
  // Stripping can empty a source that was nothing but boilerplate ("Clinical
  // Laboratory"); keep the original in that case rather than showing nothing.
  if (stripped) name = stripped;
  if (name.length <= MAX) return name;
  return `${name.slice(0, MAX - 1).trimEnd()}…`;
}
