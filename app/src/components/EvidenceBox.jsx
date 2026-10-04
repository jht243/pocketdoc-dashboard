import React from "react";
import { COLORS } from "../theme/tokens";

// The "what this is based on" line under an insight, styled as the spec's evidence
// box: accent left rule on a pale blue panel. Content is the insight's own `basis`
// string — the reference point and where the numbers came from.
function EvidenceBox({ children, style = {} }) {
  if (!children) return null;
  return (
    <div style={{
      borderLeft: `2px solid ${COLORS.accent}`, background: COLORS.accentDim,
      borderRadius: "0 6px 6px 0", padding: "7px 10px", marginTop: 8, ...style
    }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: COLORS.accent, marginBottom: 2 }}>
        Evidence
      </div>
      <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

export { EvidenceBox };
