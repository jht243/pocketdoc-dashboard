// The agents, as plain English: briefs/<agent>/brief.md and briefs/shared/rules.md.
//
// Monitus reads a newest-version overlay from Supabase first (the training bench),
// then falls back to these files. The bench is build step 4; until then the files
// ARE the agents, and this module is the one place that reads them, so adding the
// overlay later touches nothing else.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FORBIDDEN_OUTPUT_RULES } from '../../src/lib/clinicalRules.js';

const here = dirname(fileURLToPath(import.meta.url));
const BRIEFS = join(here, '..', 'briefs');

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

export const brief = (name) => read(join(BRIEFS, name, 'brief.md'));
export const rules = () => read(join(BRIEFS, 'shared', 'rules.md'));

/**
 * The system prompt an agent runs under: the shared rules, Dr. Locker's forbidden
 * output (the same text the browser chat and the insight cards are given, from the
 * one module that also enforces it), then the agent's own brief.
 */
export const systemFor = (name) => `${rules()}\n\n${FORBIDDEN_OUTPUT_RULES}\n\n---\n\n${brief(name)}`;
