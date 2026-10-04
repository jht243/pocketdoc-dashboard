// ---- Design tokens — Thumbprint Health ----
// Palette follows Section 1 of the Consumer Platform Developer Spec (doc 12): navy
// brand, teal-blue accent, and muted clinical status colors. Two deliberate
// departures: textMuted is darkened from the spec's #898781 so small captions pass
// contrast on white, and the page sits on a faint grey so white cards keep their edge.
// Key names are unchanged so every existing screen keeps compiling.
const COLORS = {
  brand: "#1A3C5E",         // screen titles, key data values
  bgDeep: "#F5F7FA",        // page background
  bgCard: "#FFFFFF",        // card surface
  bgCardAlt: "#F0F4F8",     // alt / tertiary surface (inputs, tab chips)
  teal: "#2E7D9F",          // primary accent (solid fills)
  tealLight: "#2E7D9F",     // accent for text/icons
  tealPale: "#1A3C5E",      // deeper accent for emphasis
  gold: "#8B6914",          // watch / amber text
  goldLight: "#B08A2E",
  platinum: "#5B6470",
  textPrimary: "#1A3C5E",   // ink
  textSecondary: "#4A4A4A", // body copy
  textMuted: "#737780",     // labels, timestamps
  border: "#DDE1E7",
  danger: "#8B0000",
  warning: "#8B6914",

  // --- semantic additions ---
  good: "#1A7A4A",
  goodDim: "#EAF7F2",
  warnDim: "#FFF8E7",
  badDim: "#FFF0F0",
  accent: "#2E7D9F",
  accentDim: "#EBF4FB",     // also the evidence-box background
  accentSoft: "#7FB3C9",    // third data series (score rings)
  neutralDim: "#F0F4F8",    // "Need more data" / "Building" pills
  violet: "#5B5FC7",
  strokeStrong: "#C9CFD8",
  ringTrack: "#E6EBF1",
  onAccent: "#FFFFFF",      // text/icon color on top of a solid accent fill
};

const SHADOW = "0 1px 2px rgba(26,60,94,0.05)";

// Headings and body share one sans family — the spec drops the serif display face.
const SANS = "'Inter', -apple-system, system-ui, 'Segoe UI', Arial, sans-serif";

const DISPLAY = SANS;

const RADIUS = { lg: 12, md: 10, sm: 8 };

export { COLORS };
export { SHADOW };
export { DISPLAY };
export { SANS };
export { RADIUS };
