// Writes library/README.md: every passage in the library, grouped by section, with
// its source, evidence level and approval status. Run after adding or approving a
// passage: npm run library:readme. The library test fails if the README falls behind.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const REF = join(here, 'reference');

/** Every passage under reference/, parsed the way lib/knowledge.mjs reads it. */
export function listPassages() {
  if (!existsSync(REF)) return [];
  const out = [];
  for (const section of readdirSync(REF, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    for (const file of readdirSync(join(REF, section)).filter((f) => f.endsWith('.md')).sort()) {
      const raw = readFileSync(join(REF, section, file), 'utf8');
      const fm = {};
      const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
      if (m) for (const line of m[1].split('\n')) {
        const kv = line.match(/^([a-z_]+):\s*(.*)$/);
        if (kv) fm[kv[1]] = kv[2].replace(/^"|"$/g, '').trim();
      }
      out.push({ ...fm, section, path: `${section}/${file}`, raw, body: m ? raw.slice(m[0].length) : raw });
    }
  }
  return out;
}

function render(passages) {
  const pending = passages.filter((p) => p.approved_by === 'pending').length;
  const sections = [...new Set(passages.map((p) => p.section))];
  const lines = [
    '# Knowledge library',
    '',
    pending
      ? `The passages the agents search and cite as (per "Title"). **${pending} of ${passages.length} passages are awaiting medical-director approval** (\`approved_by: pending\`); each of those is labelled "medical-director approval pending" in the prompt. None of them is a Thumbprint target.`
      : `The passages the agents search and cite as (per "Title"). **All ${passages.length} passages are approved by the medical director**; each one's \`approved_by\` and \`reviewed\` lines say who and when. None of them is a Thumbprint target.`,
    '',
    'Each passage is one rule or fact (80 to 250 words). The first set was drafted from the guidelines named in the Oct 14 build spec, section 5; later passages come from other primary sources of the same standing: society guidelines and position statements (KDIGO, AASLD, ACG, AGA, ACR, AASM, ATA, ACOG, AUA, NLA, CPIC, USPSTF, NICE, WHO), NIH, CDC and FDA material, Cochrane reviews, and landmark trials or meta-analyses in major journals. None contradicts another passage. Numbers were checked against the source named in its `url`. Adam\'s documents are guidance, not spec: where a guideline and a "functional" range disagree, the passage states the guideline and labels the tighter target Emerging.',
    '',
    '- `escalation.json`: the biomarker escalation matrix from the Recommendation Routing spec (#25), as data: per marker, the default lane (self or provider), the self-lane range, and the provider thresholds. Also awaiting approval. hs-CRP thresholds are in mg/L (the spec printed mg/dL by mistake).',
    '- `reference/<section>/*.md`: the passages. Frontmatter: `title`, `source`, `evidence` (Strong, Moderate or Emerging), `approved_by`, `as_of`, `url`, and `reviewed` once reviewed.',
    '- To approve a passage, set `approved_by` to the approver and date and `reviewed` to the date, then run `npm run library:readme`.',
    '- Review cadence: every passage is re-reviewed once a quarter, because the library is the only source for health answers (no live web search). `npm run library:review` writes `REVIEW.md`: passages never approved, approved passages more than 90 days since review, and sources more than five years old.',
    '',
  ];
  for (const s of sections) {
    lines.push(`## ${s}`, '', '| Passage | Source | Evidence | Status |', '|---|---|---|---|');
    for (const p of passages.filter((x) => x.section === s)) {
      const status = p.approved_by === 'pending' ? 'Awaiting medical-director approval' : `Approved: ${p.approved_by}`;
      lines.push(`| [${p.title}](reference/${p.path}) | ${p.source} | ${p.evidence} | ${status} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const passages = listPassages();
  writeFileSync(join(here, 'README.md'), render(passages));
  console.log(`library/README.md: ${passages.length} passages`);
}
