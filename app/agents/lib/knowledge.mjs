// The knowledge library: short, medical-director-approved passages, one folder per
// section under library/reference/. Each file has frontmatter:
//
//   ---
//   title: LDL-C targets by risk tier
//   source: 2026 ACC/AHA Dyslipidemia Guideline
//   evidence: Strong | Moderate | Emerging
//   approved_by: Dr. Adam Locker, 2026-10-21   (or `pending` until signed off)
//   reviewed: 2026-10-21
//   as_of: 2026
//   ---
//
// Retrieval is Monitus's keyword search, unchanged in shape: a specialist searches
// only its own sections, and every passage comes back labelled for citation. Swapping
// in pgvector later touches only this file.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const REF = join(here, '..', 'library', 'reference');

function frontmatter(md) {
  const out = {};
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return out;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^"|"$/g, '').trim();
  }
  return out;
}
const stripFrontmatter = (md) => (md.startsWith('---') ? md.replace(/^---[\s\S]*?---\n/, '') : md);

function listMd(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...listMd(p));
    else if (d.name.endsWith('.md')) out.push(p);
  }
  return out;
}

function chunk(text, words = 300) {
  const chunks = [];
  let buf = [];
  let n = 0;
  for (const p of text.split(/\n\s*\n/)) {
    const w = p.split(/\s+/).length;
    if (n + w > words && buf.length) { chunks.push(buf.join('\n\n')); buf = []; n = 0; }
    buf.push(p);
    n += w;
  }
  if (buf.length) chunks.push(buf.join('\n\n'));
  return chunks;
}

// Words a member's question is full of that say nothing about the topic. Without
// this, "how many steps a day should I walk" ranked a passage on alcohol first
// because it shared "how", "many", "day" and "should".
const STOP = new Set(('the and for are but not you your yours our out has have had was were will would should could can may might '
  + 'what when where which who whom why how many much more most some any all each every this that these those there their them they '
  + 'its into from with about than then also just only very really does did doing done get got getting give make made over under '
  + 'per too off own same such both between after before during again once here being been is am mine one two day days week weeks '
  + 'year years time times good bad need needs want know tell said say says like use used using way ways thing things lot lots '
  + 'member members question ask asked answer please help okay ok yes no sure mean means meaning').split(/\s+/));
// Marker names that would otherwise vanish or blur: "Lp(a)" → lpa, "vitamin D" →
// vitamin-d (so it no longer matches every vitamin), "vitamin B12" → vitamin-b12.
// Bare numbers are dropped: a member's "180" matching a passage's threshold of 180
// is coincidence, not relevance.
const normalize = (s) => String(s).toLowerCase()
  .replace(/\b([a-z]{2})\(([a-z])\)/g, '$1$2')
  .replace(/\bvitamin\s+([a-z])(\d{0,2})\b/g, 'vitamin-$1$2');
const tokenize = (s) => [...new Set((normalize(s).match(/[a-z0-9-]{3,}/g) || []).filter((t) => !STOP.has(t) && !/^[\d-]+$/.test(t)))];

/**
 * Every passage in the given sections that shares words with the query, best first,
 * one per document first. A shared word scores by how rare it is across the
 * passages searched (IDF), and counts double when it is in the passage's title.
 */
export function searchReference(sections, query, k = 5) {
  const q = new Set(tokenize(query));
  const docs = [];
  for (const section of sections) {
    for (const file of listMd(join(REF, section))) {
      const raw = readFileSync(file, 'utf8');
      const fm = frontmatter(raw);
      const rel = file.slice(REF.length + 1);
      const title = fm.title || rel.replace(/\.md$/, '');
      const cite = [title, fm.source].filter(Boolean).join(' — ');
      const titleTokens = new Set(tokenize(title));
      for (const text of chunk(stripFrontmatter(raw))) {
        docs.push({ path: rel, section: rel.split('/')[0], title, cite, evidence: fm.evidence || 'unrated', approved: Boolean(fm.approved_by && fm.approved_by !== 'pending'), text, titleTokens, tokens: new Set([...tokenize(text), ...titleTokens]) });
      }
    }
  }
  const df = new Map();
  for (const d of docs) for (const t of d.tokens) if (q.has(t)) df.set(t, (df.get(t) || 0) + 1);
  const scored = [];
  for (const { tokens, titleTokens, ...d } of docs) {
    let score = 0;
    for (const t of q) if (tokens.has(t)) score += Math.log(1 + docs.length / df.get(t)) * (titleTokens.has(t) ? 2 : 1);
    if (score > 0) scored.push({ ...d, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  const used = new Set();
  for (const c of scored) { if (!used.has(c.path)) { used.add(c.path); picked.push(c); } if (picked.length >= k) return picked; }
  for (const c of scored) { if (!picked.includes(c)) picked.push(c); if (picked.length >= k) break; }
  return picked;
}

/**
 * The passages as the prompt shows them, labelled by title. Not by number: each
 * specialist gets its own passages, so an "[R1]" from Bloodwork and one from
 * Lifestyle would be two different documents by the time the Advocate reads both.
 */
export function knowledgeBlock(passages) {
  if (!passages.length) return '## Knowledge (library)\nNo library passage covers this question. Cite no library source at all. Where you rely on general guideline consensus, say "general guidance" (shared rule 4).';
  return `## Knowledge (library). Cite a passage as (per "Title"), using only these titles\n${passages.map((p) => `### "${p.title}"\n(${p.cite}; evidence: ${p.evidence}${p.approved ? '' : '; medical-director approval pending'})\n${p.text}`).join('\n\n')}`;
}

/**
 * Drop every library citation that is not one of the passages actually handed out.
 * The model learns the citation format and will invent passages in it (a live round
 * cited four "[R34]"-style passages from an empty library), so this runs in code.
 */
export function scrubInventedCitations(text, realTitles = []) {
  const real = new Set(realTitles.map((t) => t.toLowerCase().trim()));
  return String(text)
    .replace(/\s*\(\s*\[R\d+\][^)\n]*\)/g, '')                         // ([R34] "Title")
    .replace(/\[R\d+\](?:\s*"[^"\n]*")?/g, '')                              // [R34] "Title"
    .replace(/\s*\((?:per|see|source:)\s*"([^"\n]+)"\)/gi, (m, t) => (real.has(t.toLowerCase().trim()) ? m : ''))
    .replace(/ {2,}/g, ' ')
    .replace(/ +([.,;:])/g, '$1');
}
