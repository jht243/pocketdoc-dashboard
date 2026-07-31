import React from "react";
import { COLORS, SERIF } from "../theme/tokens";

// Section headings on the live dashboard are Fraunces serif, sentence case — not the
// uppercase gold micro-label the dark mockup used.
function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: SERIF, fontWeight: 500, fontSize: 19, letterSpacing: "-0.01em",
      color: COLORS.textPrimary, marginBottom: 12
    }}>{children}</div>
  );
}

export { SectionLabel };
