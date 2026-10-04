import React from "react";
import { Fingerprint } from "lucide-react";
import { COLORS, DISPLAY } from "../theme/tokens";

const BRAND_NAME = "Thumbprint Health";

// The one logo lockup. Every screen that shows the brand renders this rather than its
// own copy, so a future logo swap is a one-file change.
function BrandMark({ size = 28, showName = true, fontSize = 17 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: DISPLAY, fontWeight: 700, fontSize, letterSpacing: "-0.01em", color: COLORS.brand }}>
      <div style={{
        width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0,
        background: COLORS.brand, display: "grid", placeItems: "center",
      }}>
        <Fingerprint size={Math.round(size * 0.6)} color={COLORS.onAccent} strokeWidth={2} />
      </div>
      {showName && BRAND_NAME}
    </div>
  );
}

export { BrandMark, BRAND_NAME };
