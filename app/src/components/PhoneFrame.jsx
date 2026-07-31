import React from "react";
import { COLORS, SANS } from "../theme/tokens";

function PhoneFrame({ children, tabBar }) {
  return (
    <div style={{
      width: 390,
      // Fit the viewport instead of a fixed 800px, so the whole device — including
      // the tab bar and composer — is visible without scrolling the page itself.
      // Scrolling belongs to #phone-scroll-area below, not the window.
      height: "min(844px, calc(100dvh - 32px))",
      background: COLORS.bgDeep,
      borderRadius: 40, border: `1px solid ${COLORS.border}`,
      boxShadow: "0 40px 120px rgba(15,23,42,0.14)",
      overflow: "hidden", position: "relative", margin: "0 auto",
      fontFamily: SANS, color: COLORS.textPrimary,
      display: "flex", flexDirection: "column"
    }}>
      {/* ambient glow behind the hero, matching the live dashboard */}
      <div style={{
        position: "absolute", top: -140, left: "50%", transform: "translateX(-50%)",
        width: 480, height: 480, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(14,165,233,0.10) 0%, rgba(34,197,94,0.06) 40%, transparent 68%)"
      }} />
      <div id="phone-scroll-area" style={{ flex: 1, overflowY: "auto", position: "relative", minHeight: 0 }}>
        {children}
      </div>
      {tabBar}
    </div>
  );
}

export { PhoneFrame };
