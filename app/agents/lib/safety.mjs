// Safety, in code, before and after the model. Oct 14 spec, section 3: the Safety
// agent must never be the only check; "its core rules run as code before and after
// the model."
//
// Every rule here comes from src/lib/clinicalRules.js, the same module the browser
// chat and the insight cards use, so there is one copy of Dr. Locker's rules.
import {
  detectUrgentPatterns, hasFunctionalConcern, violatesForbiddenOutput, scrubForbidden, offendingSentences, FORBIDDEN_OUTPUT_RULES,
} from '../../src/lib/clinicalRules.js';
import { complete } from './llm.mjs';

const CRISIS_LINE = "If you're thinking about harming yourself, call or text 988 now";

/** Before any agent runs: critical values on file and crisis language in the question. */
export function precheck({ healthData, question }) {
  const found = detectUrgentPatterns({ healthData, messages: [{ role: 'user', text: question }] })
    .filter((u) => u.kind !== 'recheck');
  return {
    crisis: found.some((u) => u.id === 'crisis'),
    urgent: found.map((u) => (u.id === 'crisis' ? CRISIS_LINE : u.label)),
    lines: found.map((u) => `- URGENT: ${u.id === 'crisis' ? CRISIS_LINE : `${u.label}: ${u.message}`}${u.source ? ` (${u.source})` : ''}`),
  };
}

/**
 * After the model: anything that still breaks a forbidden-output rule gets up to two
 * rewrites, and whatever survives those is cut sentence by sentence.
 *
 * `found` is what the model first wrote that broke a rule ({ problem, excerpt }), or
 * null: the safety log records it for the medical director's weekly review.
 */
export async function enforce({ reply, healthData, run, onFlag }) {
  const functional = hasFunctionalConcern(healthData);
  const breaks = (text) => violatesForbiddenOutput(text, { hasFunctionalConcern: functional });
  let problem = breaks(reply);
  let revised = false;
  let scrubbed = false;
  const found = problem ? { problem, excerpt: offendingSentences(reply, breaks) } : null;
  if (problem) onFlag?.(problem);
  for (let attempt = 0; problem && attempt < 2; attempt++) {
    try {
      const fixed = await complete({
        system: `You edit health guidance so it obeys the app's clinical rules. Keep the substance, structure and length, and change only what breaks a rule. Return the full corrected reply, nothing else.

${FORBIDDEN_OUTPUT_RULES}

For doses specifically: remove EVERY amount of a supplement or medication, including ranges and "commonly used" or "typical" doses (any number with IU, mcg, mg, g or units). Say what the supplement is for and that the member's prescriber sets the amount. Lab values with their units (e.g. "28 ng/mL") are fine and stay.`,
        user: `Rule broken: ${problem}\n\nReply to correct:\n${reply}`,
        tier: 'cheap', maxTokens: 1800, label: 'safety:rewrite', run,
      });
      if (fixed) { reply = fixed; revised = true; }
    } catch (err) {
      console.log(`[safety:rewrite] failed: ${err.message}`);
      break;
    }
    problem = breaks(reply);
  }
  if (problem) {
    const cut = scrubForbidden(reply, breaks);
    if (cut !== reply) { reply = cut; revised = true; scrubbed = true; }
    problem = breaks(reply);
  }
  return { reply, clean: !problem, revised, scrubbed, problem, found };
}
