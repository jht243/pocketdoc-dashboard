// The agents, as plain English: briefs/<agent>/brief.md and briefs/shared/rules.md.
//
// Monitus reads a newest-version overlay from Supabase first (the training bench),
// then falls back to these files. The bench is build step 4; until then the files
// ARE the agents, and this module is the one place that reads them, so adding the
// overlay later touches nothing else.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CLINICAL_ANALYSIS_RULES, FORBIDDEN_OUTPUT_RULES } from '../../src/lib/clinicalRules.js';

const here = dirname(fileURLToPath(import.meta.url));
const BRIEFS = join(here, '..', 'briefs');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

export const brief = (name) => read(join(BRIEFS, name, 'brief.md'));
export const rules = () => read(join(BRIEFS, 'shared', 'rules.md'));

// The router only picks specialists and writes their asks; it is told the rules for
// what the member reads (the forbidden list) but not how to analyse a record.
const ROUTING_ONLY = new Set(['advocate']);

/**
 * The system prompt an agent runs under: the shared rules, Dr. Locker's clinical
 * analysis rules and forbidden output (the same text the browser chat and the insight
 * cards are given, from the one module that also enforces it), then the agent's own
 * brief. Every agent that reads the record or writes for the member gets all of his
 * rules, not just the forbidden list.
 */
export const systemFor = (name) => [
  rules(),
  ROUTING_ONLY.has(name) ? null : `# Dr. Locker's clinical analysis rules (AI Clinical Intelligence Engine spec, Aug 2026)\n"Card" below means anything you write: a finding, an answer, an insight card.\n\n${CLINICAL_ANALYSIS_RULES}`,
  FORBIDDEN_OUTPUT_RULES,
  '---',
  brief(name),
].filter(Boolean).join('\n\n');
