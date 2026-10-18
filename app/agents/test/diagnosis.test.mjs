// Dr. Locker's diagnosis boundary, as code (src/lib/clinicalRules.js). The live
// care team wrote "which shows active Hashimoto's" and the old patterns, which only
// knew "you have…", let it through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { violatesForbiddenOutput } from '../../src/lib/clinicalRules.js';

const CAUGHT = [
  "Your TPO antibodies are high and rising, which shows active Hashimoto's.",
  "Stable TSH but rising antibodies, suggesting ongoing Hashimoto's activity.",
  'Your ferritin of 9 indicates anemia.',
  'This confirms hypothyroidism.',
  'These labs mean diabetes.',
  'You have Hashimoto’s thyroiditis.',
];

// Pattern language the rules ask for, and plain statements of results, stay allowed.
const ALLOWED = [
  'Rising TPO antibodies with a steady TSH are consistent with autoimmune thyroid activity; free T4 would help clarify it.',
  'This pattern suggests insulin resistance may be developing, most likely because of your rising fasting insulin.',
  'A celiac panel shows whether gluten is involved.',
  'An A1c test screens for diabetes.',
  'Your labs show an LDL of 142 mg/dL (Sep 2026).',
  'Your family history raises your risk of heart disease.',
  'Your average glucose (mean 102) is fine.',
  'You have logged fatigue on four mornings this week.',
  // From the library: definitions and screening logic, not claims about the member.
  'A positive screen is followed by a full clinical assessment to confirm a diagnosis and plan care.',
  'The score is suppressed during pregnancy, active cancer treatment or acute illness.',
  'The high negative predictive value means advanced fibrosis is unlikely.',
];

test('asserted diagnoses are caught', () => {
  for (const t of CAUGHT) assert.equal(violatesForbiddenOutput(t), 'diagnosis language', t);
});

test('pattern language and plain results are allowed', () => {
  for (const t of ALLOWED) assert.equal(violatesForbiddenOutput(t), null, t);
});
