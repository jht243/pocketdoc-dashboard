import React from "react";
import { COLORS, RADIUS, SHADOW } from "../theme/tokens";

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: COLORS.bgCard, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`,
      boxShadow: SHADOW, padding: "14px 16px", marginBottom: 12, ...style
    }}>{children}</div>
  );
}

export { Card };
