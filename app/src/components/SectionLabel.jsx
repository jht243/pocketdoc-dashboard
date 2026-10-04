import React from "react";
import { COLORS } from "../theme/tokens";

// Section headings follow the spec's grouping label — small, bold, uppercase, muted —
// so a screen's hierarchy reads from the cards, not from competing headlines.
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      color: COLORS.textMuted, marginBottom: 8, marginTop: 4
    }}>{children}</div>
  );
}

export { SectionLabel };
