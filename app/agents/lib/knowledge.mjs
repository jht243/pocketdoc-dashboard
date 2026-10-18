// The knowledge library: short, medical-director-approved passages, one folder per
// section under library/reference/. Each file has frontmatter:
//
//   ---
//   title: LDL-C targets by risk tier
//   source: 2026 ACC/AHA Dyslipidemia Guideline
//   evidence: Strong | Moderate | Emerging
//   approved_by: pending
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

const tokenize = (s) => [...new Set(String(s).toLowerCase().match(/[a-z0-9-]{3,}/g) || [])];

/** Every passage in the given sections that shares words with the query, best first, one per document first. */
export function searchReference(sections, query, k = 5) {
  const q = new Set(tokenize(query));
  const scored = [];
  for (const section of sections) {
    for (const file of listMd(join(REF, section))) {
      const raw = readFileSync(file, 'utf8');
      const fm = frontmatter(raw);
      const rel = file.slice(REF.length + 1);
      const title = fm.title || rel.replace(/\.md$/, '');
      const cite = [title, fm.source].filter(Boolean).join(' — ');
      for (const text of chunk(stripFrontmatter(raw))) {
        let score = 0;
        for (const t of tokenize(text)) if (q.has(t)) score++;
        if (score > 0) scored.push({ path: rel, section: rel.split('/')[0], title, cite, evidence: fm.evidence || 'unrated', approved: fm.approved_by && fm.approved_by !== 'pending', score, text });
      }
    }
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
