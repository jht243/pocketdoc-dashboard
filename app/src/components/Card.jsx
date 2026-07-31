import React from "react";
import { COLORS, RADIUS, SHADOW } from "../theme/tokens";

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: COLORS.bgCard, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`,
      boxShadow: SHADOW, padding: 18, marginBottom: 14, ...style
    }}>{children}</div>
  );
}

export { Card };
