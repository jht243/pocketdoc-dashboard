// Buttons into the app: an answer may end a bullet with [[app:<screen>|<label>]], and
// only the five whitelisted screens survive. Checked on the shared module, then end
// to end through the pipeline with the model stubbed, so a token the model invents
// never reaches the member and an allowed one comes through the safety net and the
// bottom-line tidy intact.
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'test-key-not-real';
const { sanitizeAppLinks, parseAppLink, APP_LINK_TARGETS } = await import('../../src/lib/appLinks.js');
const { runQuestion, tidyBottomLine } = await import('../lib/team.mjs');
const { scrubInventedCitations } = await import('../lib/knowledge.mjs');

const facts = {
  preamble: "TODAY'S DATE: 2026-10-18",
  sections: [
    { key: 'profile', title: 'USER PROFILE', body: '- Age: 54\n- Sex at birth / recorded sex: male' },
    { key: 'medications', title: 'MEDICATIONS & SUPPLEMENTS', body: '(none recorded)' },
    { key: 'labs', title: 'LAB RESULTS', body: '(none recorded)' },
  ],
};

function stubModel(composeText) {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const system = body.messages[0].content;
    let content;
    if (system.includes('Agent: My Advocate (the manager)')) {
      content = JSON.stringify({ reason: 'Your fatigue needs labs.', consult: [{ id: 'bloodwork', ask: 'What labs would look into fatigue?' }] });
    } else if (system.includes('Agent: Safety Review')) {
      content = 'All claims supported.';
    } else if (system.includes('My Advocate, writing the answer')) {
      content = composeText;
    } else if (system.startsWith('You edit health guidance')) {
      // A rewrite that fixes nothing, so the deterministic scrub has to do the cut.
      content = body.messages.at(-1).content.split('Reply to correct:\n')[1];
    } else {
      content = "No labs on file.\n\n## For the member's screen\nHeadline: No labs yet\nFinding: Our member has no bloodwork on file.\nFlag: ok";
    }
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: {} }), { status: 200 });
  };
}

test('the whitelist is exactly the five screens the brief names', () => {
  assert.deepEqual(Object.keys(APP_LINK_TARGETS).sort(), ['discussion', 'healthhistory', 'importlabs', 'orderlabs', 'preventivecare']);
});

test('an allowed token is kept, canonical', () => {
  const t = '- **Ask for a CBC** to look into fatigue. [[app:orderlabs|Order bloodwork]]';
  assert.equal(sanitizeAppLinks(t), t);
  assert.equal(sanitizeAppLinks('[[ App:ImportLabs | Upload your labs ]]'), '[[app:importlabs|Upload your labs]]');
  // No label: the default one for that screen.
  assert.equal(sanitizeAppLinks('[[app:preventivecare]]'), '[[app:preventivecare|Mark your screenings]]');
  assert.deepEqual(parseAppLink('[[app:discussion|Prepare for your visit]]'), { id: 'discussion', label: 'Prepare for your visit' });
});

test('an unknown id becomes its plain label, never a button', () => {
  assert.equal(sanitizeAppLinks('Open [[app:account|Your account]] now.'), 'Open Your account now.');
  assert.equal(sanitizeAppLinks('Go [[app:https://evil.example|Claim reward]].'), 'Go Claim reward.');
  assert.equal(sanitizeAppLinks('Nothing here [[app:market]].'), 'Nothing here.');
  assert.equal(parseAppLink('[[app:account|Your account]]'), null);
  assert.equal(parseAppLink('[[app:orderlabs|x]] trailing'), null);
});

test('a label cannot carry markup, a link or another token', () => {
  assert.equal(sanitizeAppLinks('[[app:orderlabs|<img src=x onerror=alert(1)>]]'), '[[app:orderlabs|img srcx onerroralert1]]');
  assert.doesNotMatch(sanitizeAppLinks('[[app:orderlabs|[click](http://x)]]'), /\[\[app:orderlabs\|[^\]]*http/);
  assert.ok(sanitizeAppLinks(`[[app:orderlabs|${'x'.repeat(200)}]]`).length <= '[[app:orderlabs|]]'.length + 40);
});

test('bold or backticks around a token are unwrapped so the button still renders', () => {
  assert.equal(sanitizeAppLinks('**[[app:orderlabs|Order bloodwork]]**'), '[[app:orderlabs|Order bloodwork]]');
  assert.equal(sanitizeAppLinks('`[[app:healthhistory|Finish it]]`'), '[[app:healthhistory|Finish it]]');
});

test('the citation scrubber and the bottom-line tidy leave a token alone', () => {
  const t = '**I would start with bloodwork. Nothing on file explains the fatigue yet.**\n\n## What you can do\n- **Get a CBC, ferritin and TSH** to look into fatigue. [[app:orderlabs|Order bloodwork]]';
  assert.equal(scrubInventedCitations(t, []), t);
  assert.equal(tidyBottomLine(t), t);
});

test('the pipeline keeps allowed buttons and strips invented ones', async () => {
  stubModel([
    "**Nothing on file explains your fatigue yet; a first blood panel is the next step.**",
    '',
    '## What you can do',
    '- **Get a CBC, ferritin and TSH**, the tests that look into fatigue. [[app:orderlabs|Order bloodwork]]',
    '- **Upload any older report** you already have. [[app:importlabs|Upload your labs]]',
    '- **Check your settings** first. [[app:account|Open settings]]',
    '- **Claim your reward**. [[app:javascript:alert(1)|Tap here]]',
    '',
    "## Bring this to your provider",
    '- **Fatigue for two months** is worth raising. [[app:discussion|Prepare for your visit]]',
  ].join('\n'));
  const { reply } = await runQuestion({ question: 'Why am I so tired?', facts, healthData: {}, run: { ledger: [] } }, () => {});
  assert.match(reply, /\[\[app:orderlabs\|Order bloodwork\]\]/);
  assert.match(reply, /\[\[app:importlabs\|Upload your labs\]\]/);
  assert.match(reply, /\[\[app:discussion\|Prepare for your visit\]\]/);
  assert.doesNotMatch(reply, /\[\[app:account/);
  assert.doesNotMatch(reply, /javascript/);
  assert.match(reply, /first\. Open settings/);
  // Every token left in the reply is a whitelisted one.
  for (const [, id] of reply.matchAll(/\[\[app:([^|\]]*)/g)) assert.ok(id in APP_LINK_TARGETS, id);
});

test('a token survives the code safety net when a dose is cut from the same bullet', async () => {
  stubModel('**Your vitamin D needs a first test.**\n\n## What you can do\n- **Get vitamin D tested**. Take 5000 IU of vitamin D3 daily. [[app:orderlabs|Order bloodwork]]');
  const { reply } = await runQuestion({ question: 'Should I take vitamin D?', facts, healthData: {}, run: { ledger: [] } }, () => {});
  assert.doesNotMatch(reply, /5000 IU/);
  assert.match(reply, /\[\[app:orderlabs\|Order bloodwork\]\]/);
});
