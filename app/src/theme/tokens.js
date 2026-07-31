

// ---- Design tokens (ported to the PocketDoc light system used on the live dashboard) ----
// Key names are unchanged so every existing screen keeps compiling; only the values moved
// from the old dark palette to the light one. Semantic aliases are added below for the
// screens that have been fully ported.
const COLORS = {
  bgDeep: "#f6f7f9",        // page background
  bgCard: "#ffffff",        // card surface
  bgCardAlt: "#f2f5f8",     // alt / hover surface
  teal: "#0284c7",          // primary accent (solid fills)
  tealLight: "#0284c7",     // accent for text/icons (must stay readable on white)
  tealPale: "#0369a1",      // deeper accent for emphasis
  gold: "#d97706",          // warn / base-ring
  goldLight: "#f59e0b",
  platinum: "#55657a",
  textPrimary: "#0f172a",   // ink
  textSecondary: "#55657a", // ink-2
  textMuted: "#8494a7",     // ink-3
  border: "rgba(15,23,42,0.08)",
  danger: "#dc2626",
  warning: "#d97706",

  // --- semantic additions (Render design system) ---
  good: "#16a34a",
  goodDim: "rgba(22,163,74,0.10)",
  warnDim: "rgba(217,119,6,0.10)",
  badDim: "rgba(220,38,38,0.08)",
  accent: "#0284c7",
  accentDim: "rgba(2,132,199,0.08)",
  violet: "#6366f1",
  strokeStrong: "rgba(15,23,42,0.14)",
  ringTrack: "#e5eaf0",
  onAccent: "#ffffff",      // text/icon color on top of a solid accent fill
};

const SHADOW = "0 1px 2px rgba(15,23,42,0.04), 0 10px 30px rgba(15,23,42,0.06)";

const SERIF = "'Fraunces', Georgia, serif";

const SANS = "'Inter', -apple-system, system-ui, sans-serif";

const RADIUS = { lg: 22, md: 16, sm: 12 };

export { COLORS };
export { SHADOW };
export { SERIF };
export { SANS };
export { RADIUS };
