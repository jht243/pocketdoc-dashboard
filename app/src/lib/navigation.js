/**
 * Screen names and back-link rules for the in-app navigation history.
 *
 * The app routes with a single `active` screen id rather than URLs, so nothing
 * remembered where the member came from: every back link was hard-coded to one
 * screen, and a member who opened Medications from Care was sent to Home. App.jsx
 * keeps a small stack of the screens visited since the last tab tap; these rules
 * decide what that stack does and what the back link is called.
 */

// What each screen is called in a "Back to …" link. The five tabs use the names on
// the tab bar, so the link never says "Labs" or "Profile" for a tab that reads
// "Biology" or "Care".
export const SCREEN_NAMES = {
  home: "Home",
  labs: "Biology",
  profile: "Care",
  records: "Records",
  aichat: "Team",
  market: "Marketplace",
  discussion: "Discussion page",
  orderlabs: "Order bloodwork",
  browsesupplements: "Browse supplements",
  account: "Account",
  body: "Body",
  importlabs: "Import",
  geneticprofile: "Genetic profile",
  medications: "Medications",
  preventivecare: "Preventive care",
  healthhistory: "Health history",
  checkin: "Check-in",
};

// The tab-bar screens. Arriving on one starts a fresh history: a tab is a top-level
// place, so it has no back link, and stepping back out of a screen opened from it
// should land on it rather than somewhere visited before the tab was tapped.
export const TAB_SCREENS = new Set(["home", "labs", "profile", "records", "aichat"]);

// Where a back link goes when there is no history to return to — after a reload
// mid-screen, or when the app landed directly on a sub-screen. Each is the tab the
// screen is normally reached from.
const DEFAULT_PARENT = {
  discussion: "records",
  orderlabs: "labs",
  importlabs: "records",
  geneticprofile: "profile",
  medications: "profile",
  preventivecare: "profile",
  market: "profile",
  browsesupplements: "market",
};

// Long enough for any real path through the app; bounded so it can't grow forever.
const MAX_HISTORY = 20;

/** The history after moving from `from` to `to`. */
export function pushHistory(history, from, to) {
  if (TAB_SCREENS.has(to)) return [];
  if (!from || from === to || from === "onboarding") return history;
  // Returning to a screen already in the stack (e.g. a "Done" button that goes back
  // to where the flow started) drops everything after it, so the next back link
  // doesn't bounce the member through the flow they just finished.
  const seen = history.indexOf(to);
  if (seen !== -1) return history.slice(0, seen);
  return [...history, from].slice(-MAX_HISTORY);
}

/** The screen a back link on `current` returns to. */
export function backTarget(history, current) {
  return history[history.length - 1] || DEFAULT_PARENT[current] || "home";
}

/** "Back to Care", "Back to Biology", … for the screen a back link returns to. */
export function backLabel(target) {
  return `Back to ${SCREEN_NAMES[target] || "Home"}`;
}
