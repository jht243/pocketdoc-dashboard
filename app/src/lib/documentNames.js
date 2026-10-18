/**
 * The rules for a document's name and test date, kept apart from the model call that
 * produces them.
 *
 * No imports, on purpose: these decide which of a member's documents get renamed and
 * whether that can ever repeat, so they're tested directly under `node --test`
 * (app/agents/test/documentNames.test.mjs), which can't load the app's
 * extensionless imports.
 */

/**
 * Has this document never been given a content-based name?
 *
 * Every file a browser hands over carries an extension (.pdf, .jpg, .HEIC, .txt) and a
 * generated name never does, so the extension is the marker — it lets the Records list
 * name files stored before naming existed, exactly once, without a column to track it.
 */
export function needsContentName(fileName) {
  return !fileName || /\.[a-z0-9]{2,5}$/i.test(String(fileName).trim());
}

/**
 * A date on the end of a title: " — Aug 2026", " - Sep 17, 2026".
 *
 * The first naming scheme put the date in the title ("Quest Diagnostics Annual Blood
 * Panel — Aug 2026"): too long to fit a phone, and the date sat in the one place the
 * list couldn't swap for the test date.
 */
export const DATED_NAME = /\s+[—–-]\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?\d{4}\s*$/i;

/**
 * Does this already-named document still carry the old dated name, and is there
 * somewhere to put the test date a re-read would give it?
 *
 * Re-running is safe exactly once: a new name never ends in a date (`cleanName` strips
 * one even if the model adds it), so a document that has been through this no longer
 * matches and is never re-read again, whether or not a date was found. The
 * `collected_on` key only exists on the row once the column does; until that migration
 * has run these documents are left alone, rather than renamed without their date —
 * which, once renamed, they could never get back.
 */
export function needsTestDate(document) {
  if (!document || !Object.prototype.hasOwnProperty.call(document, "collected_on")) return false;
  if (document.collected_on) return false;
  return DATED_NAME.test(String(document.file_name || ""));
}

/** Should this stored document be (re)named from its text? */
export function needsNaming(document) {
  return needsContentName(document?.file_name) || needsTestDate(document);
}

/** Clean a title into something safe to show and store, or null. */
export function cleanName(raw) {
  const name = String(raw || "")
    .split("\n")[0]
    .replace(/^["'`*\s]+|["'`*\s]+$/g, "")
    .replace(/^title:\s*/i, "")
    // A period anywhere could end up looking like an extension, which would mark the
    // document as unnamed and have it renamed on every visit.
    .replace(/\./g, "")
    // The date belongs in collected_on, not the title — and a title ending in one
    // would match the old dated pattern and be re-read on every visit.
    .replace(DATED_NAME, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || /^unknown$/i.test(name) || name.length > 90) return null;
  return name;
}

/**
 * A test date we can store, or null.
 *
 * Strict on purpose: a date column holding a misread birthday or a year-3024 typo
 * would be believed by the list and by every "newest reading" pick downstream.
 */
export function cleanTestDate(raw, now = Date.now()) {
  const match = String(raw || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const t = Date.UTC(y, m - 1, d);
  const back = new Date(t);
  // Rejects 2026-02-30 and friends, which Date.UTC would quietly roll into March.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) return null;
  if (y < 1950) return null;
  // A day of slack for time zones; anything later than that is a misread.
  if (t > now + 24 * 60 * 60 * 1000) return null;
  return match[0];
}

/**
 * Read the namer's reply — JSON when it behaves, salvaged when it doesn't.
 *
 * The reply can arrive fenced, wrapped in a sentence, or as the bare one-line title
 * the old prompt asked for. Any of those still yields a name; a date is only kept
 * when it is clearly the field we asked for.
 *
 * @returns {{title: string|null, collectedOn: string|null}}
 */
export function parseNameReply(raw, now = Date.now()) {
  const clean = String(raw || "").replace(/```json|```/g, "").trim();
  let title = null;
  let collected = null;
  try {
    const parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1));
    if (parsed && typeof parsed === "object") {
      title = parsed.title ?? null;
      collected = parsed.collected_on ?? null;
    }
  } catch {
    const t = clean.match(/"title"\s*:\s*"([^"]*)"/i);
    const c = clean.match(/"collected_on"\s*:\s*"([^"]*)"/i);
    if (t) title = t[1];
    if (c) collected = c[1];
    // No JSON at all: the whole first line is the title, as the old prompt returned.
    if (!t && !clean.includes("{")) title = clean;
  }
  return { title: cleanName(title), collectedOn: cleanTestDate(collected, now) };
}
