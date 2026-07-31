import React from "react";
import { COLORS } from "../theme/tokens";

function ScoreGauge({ basePts = 28, baseMax = 50, dailyPts = 23, dailyMax = 50, onTap }) {
  const total = basePts + dailyPts;
  // Rings sit close together near the outer edge so the centre stays clear for the
  // score readout — at tighter radii the inner ring cut straight through the label.
  const outerR = 92, innerR = 77, stroke = 12;
  const outerCirc = 2 * Math.PI * outerR;
  const innerCirc = 2 * Math.PI * innerR;
  const basePct = basePts / baseMax;
  const dailyPct = dailyPts / dailyMax;

  const Bar = ({ label, value, max, color }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{label}</span>
        <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{value} / {max}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: COLORS.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(value / max) * 100}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );

  return (
    <button onClick={onTap} style={{
      background: "none", border: "none", padding: 0, cursor: "pointer", display: "block", width: "100%"
    }}>
      <div style={{ position: "relative", width: 216, height: 216, margin: "0 auto" }}>
        <svg width="216" height="216" style={{ transform: "rotate(-90deg)" }}>
          <defs>
            <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          {/* outer ring: base / preventive care */}
          <circle cx="108" cy="108" r={outerR} fill="none" stroke={COLORS.ringTrack} strokeWidth={stroke} />
          <circle cx="108" cy="108" r={outerR} fill="none" stroke="url(#scoreGrad)"
            strokeWidth={stroke} strokeDasharray={`${outerCirc * basePct} ${outerCirc}`} strokeLinecap="round"
            style={{ filter: "drop-shadow(0 2px 8px rgba(22,163,74,0.25))" }} />
          {/* inner ring: daily / weekly */}
          <circle cx="108" cy="108" r={innerR} fill="none" stroke={COLORS.ringTrack} strokeWidth={stroke} />
          <circle cx="108" cy="108" r={innerR} fill="none" stroke={COLORS.accent}
            strokeWidth={stroke} strokeDasharray={`${innerCirc * dailyPct} ${innerCirc}`} strokeLinecap="round" />
        </svg>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2
        }}>
          <span style={{ fontSize: 58, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: COLORS.textPrimary }}>{total}</span>
          <span style={{ fontSize: 10.5, color: COLORS.textMuted, fontWeight: 600, letterSpacing: "0.12em" }}>HEALTH SCORE</span>
        </div>
      </div>
      <div style={{ marginTop: 18, padding: "0 8px", textAlign: "left" }}>
        <Bar label="Base · preventive care" value={basePts} max={baseMax} color={COLORS.gold} />
        <Bar label="Daily / weekly" value={dailyPts} max={dailyMax} color={COLORS.tealLight} />
      </div>
    </button>
  );
}

export { ScoreGauge };
