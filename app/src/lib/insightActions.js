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

/** The label to show on an insight card's action button. */
export function insightActionLabel(action) {
  if (!action) return "";
  return FIXED_LABELS[action.target] || action.label;
}

/**
 * Follow an insight card's action. Discussion and body-fat targets are screens;
 * every other target is a Marketplace highlight.
 */
export function runInsightAction(action, { setActive, goToMarket }) {
  if (!action) return;
  if (action.target === "discussion") setActive("discussion");
  else if (action.target === "bodyfat_history") setActive("body");
  else goToMarket(action.target);
}
