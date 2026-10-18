/**
 * Links from a chat answer into the app.
 *
 * When the Advocate tells a member to get bloodwork, upload a report, mark their
 * screenings, finish their health history or prepare for a visit, the member should
 * be able to tap straight there rather than hunt for the screen. The answer carries
 * that as a token at the end of the bullet:
 *
 *   [[app:orderlabs|Order bloodwork]]
 *
 * `orderlabs` is a screen id from App.jsx's screen map and the text after the bar is
 * the button's label. Only the ids below are ever honoured. The answer is model
 * output, so a token naming anything else (another screen, a URL, markup) is reduced
 * to its plain label: nothing in a reply can send the member somewhere we did not
 * choose. The agents server runs `sanitizeAppLinks` on every answer it composes, and
 * RichReply runs it again on whatever it is handed (an older stored reply, or the
 * browser care team's), so both ends hold the same list.
 *
 * Plain JavaScript with no browser imports: the agents server imports this file too.
 */

/** The only screens an answer may link to, with the label used when none is given. */
export const APP_LINK_TARGETS = Object.freeze({
  orderlabs: "Order bloodwork",
  importlabs: "Upload your labs",
  preventivecare: "Mark your screenings",
  discussion: "Prepare for your visit",
  healthhistory: "Finish your health history",
});

const MAX_LABEL = 40;

// Any [[app:...]] token, however the model spaced or wrapped it. A token the model
// put in bold, italics or backticks ("**[[app:x|Y]]**") is unwrapped too, so the
// markers do not swallow the button when the reply is rendered.
const ANY_TOKEN = /(\*\*|__|\*|_|`)?\[\[\s*app\s*:\s*([^[\]|\n]*?)\s*(?:\|\s*([^[\]\n]*?)\s*)?\]\]\1/gi;

// What a token looks like once it has been through sanitizeAppLinks.
export const APP_LINK_TOKEN = /\[\[app:([a-z]+)\|([^\]\n]+)\]\]/;

/**
 * A label the button can show: letters, digits, spaces and light punctuation, short.
 * Markdown and bracket characters are dropped so a label cannot open a second token
 * or a link.
 */
function cleanLabel(label) {
  return String(label || "")
    .replace(/[^\p{L}\p{N} '’,&\-–/]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL)
    .trim();
}

/**
 * Every [[app:...]] token in `text`, made safe: an allowed id keeps a canonical
 * token with a clean label; an unknown id becomes its label as plain text (or
 * nothing, if it had none). Text with no token comes back unchanged.
 */
export function sanitizeAppLinks(text) {
  const t = String(text ?? "");
  if (!t.includes("[[")) return t;
  return t
    .replace(ANY_TOKEN, (m, _wrap, rawId, rawLabel) => {
      const id = String(rawId || "").trim().toLowerCase();
      const label = cleanLabel(rawLabel);
      if (Object.prototype.hasOwnProperty.call(APP_LINK_TARGETS, id)) {
        return `[[app:${id}|${label || APP_LINK_TARGETS[id]}]]`;
      }
      return label;
    })
    // A dropped token can leave "text ." or a double space behind.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:])/g, "$1")
    .replace(/[ \t]+$/gm, "");
}

/** `{ id, label }` for a canonical token, or null for anything else. */
export function parseAppLink(token) {
  const m = new RegExp(`^${APP_LINK_TOKEN.source}$`).exec(String(token || ""));
  if (!m || !Object.prototype.hasOwnProperty.call(APP_LINK_TARGETS, m[1])) return null;
  return { id: m[1], label: m[2] };
}
