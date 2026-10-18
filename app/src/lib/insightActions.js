/**
 * The button on an insight card: what it says and where it goes.
 *
 * Insight cards carry an `action` of { label, target }. The AI writes its own label,
 * and for the "discussion" target it wrote things like "Set appointment" — but that
 * button opens the Discussion page, which prepares the member for a visit and books
 * nothing. A label has to describe what the tap does, so for that target the app
 * uses a fixed one instead of whatever the model wrote.
 */

const FIXED_LABELS = {
  discussion: "Prepare for your visit",
};

const LIVE_TARGETS = new Set(["discussion", "bodyfat_history"]);

/**
 * The card's action when it still leads somewhere, else null. Cards cached before
 * Oct 19 2026 can carry a store target ("iv", "vitd3"); those lose their button.
 */
export function liveInsightAction(action) {
  return action && LIVE_TARGETS.has(action.target) ? action : null;
}

/** The label to show on an insight card's action button. */
export function insightActionLabel(action) {
  if (!action) return "";
  return FIXED_LABELS[action.target] || action.label;
}

/**
 * Follow an insight card's action. Only the Discussion page and the body-fat trend:
 * a health finding never opens the store (Adam Locker, Oct 19 2026), so an older
 * cached card that still names a store target does nothing.
 */
export function runInsightAction(action, { setActive }) {
  if (!liveInsightAction(action)) return;
  if (action.target === "discussion") setActive("discussion");
  else if (action.target === "bodyfat_history") setActive("body");
}
